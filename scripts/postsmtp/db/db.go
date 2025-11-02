package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
)

// DB wraps the database connection and provides methods for database operations
type DB struct {
	conn *sql.DB
}

// New creates a new database connection using the provided connection string
func New(connString string) (*DB, error) {
	conn, err := sql.Open("postgres", connString)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %v", err)
	}

	// Test connection
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %v", err)
	}

	db := &DB{conn: conn}

	// Create tables if they don't exist
	if err := db.CreateTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %v", err)
	}

	log.Println("Connected to PostgreSQL database")
	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// CreateTables creates the necessary database tables if they don't exist
func (db *DB) CreateTables() error {
	// Create users table if it doesn't exist
	usersTable := `
	CREATE TABLE IF NOT EXISTS users (
		id SERIAL PRIMARY KEY,
		username VARCHAR(255) UNIQUE NOT NULL,
		password TEXT NOT NULL,
		salt TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	// Create mail table if it doesn't exist
	mailTable := `
	CREATE TABLE IF NOT EXISTS mail (
		uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		recipient VARCHAR(255) NOT NULL,
		sender VARCHAR(255) NOT NULL,
		headers JSONB NOT NULL,
		message TEXT NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := db.conn.Exec(usersTable); err != nil {
		return fmt.Errorf("failed to create users table: %v", err)
	}

	if _, err := db.conn.Exec(mailTable); err != nil {
		return fmt.Errorf("failed to create mail table: %v", err)
	}

	log.Println("Database tables created/verified")
	return nil
}

// ValidateRecipient checks if a username exists in the users table
func (db *DB) ValidateRecipient(username string) bool {
	var exists bool
	err := db.conn.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
		username,
	).Scan(&exists)
	if err != nil {
		log.Printf("Error checking username: %v", err)
		return false
	}
	return exists
}

// StoreMessage stores an email message in the database
func (db *DB) StoreMessage(mailFrom string, rcptTo []string, data []byte) error {
	// Log raw data for debugging
	log.Printf("[StoreMessage] Raw data length: %d bytes\n", len(data))
	if len(data) > 0 {
		// Log first 200 bytes as hex/string for debugging
		preview := data
		if len(preview) > 200 {
			preview = preview[:200]
		}
		log.Printf("[StoreMessage] Data preview (first 200 bytes): %q\n", string(preview))
	}

	// Parse email to extract headers and body
	// Normalize line endings: convert \r\n to \n, then handle any remaining \r
	emailStr := string(data)
	// Replace \r\n with \n first, then any remaining \r with \n
	emailStr = strings.ReplaceAll(emailStr, "\r\n", "\n")
	emailStr = strings.ReplaceAll(emailStr, "\r", "\n")

	lines := strings.Split(emailStr, "\n")
	log.Printf("[StoreMessage] Parsed into %d lines\n", len(lines))

	headers := make(map[string]string)
	var body strings.Builder
	inBody := false
	var currentHeader string
	headerEndIndex := -1

	// First pass: find where headers end (empty line)
	for i, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if trimmedLine == "" && !inBody {
			inBody = true
			headerEndIndex = i
			log.Printf("[StoreMessage] Found header/body separator at line %d\n", i+1)
			break
		}
	}

	// Second pass: parse headers and body
	for i, line := range lines {
		// Remove trailing \r if present (shouldn't happen after normalization, but be safe)
		line = strings.TrimRight(line, "\r")

		if i <= headerEndIndex {
			// Still in headers (including the empty line)
			if i == headerEndIndex {
				// This is the empty line, skip it
				continue
			}

			// Parse headers - must start at beginning of line (not continuation)
			// Continuation lines start with space or tab
			trimmedLine := strings.TrimSpace(line)
			if trimmedLine == "" {
				// Empty line means end of headers (should have been caught earlier)
				continue
			}

			if strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t") {
				// Continuation of previous header (folded header according to RFC 5322)
				if currentHeader != "" {
					// Append to existing header value (remove leading whitespace)
					headers[currentHeader] = headers[currentHeader] + " " + strings.TrimSpace(line)
				}
			} else if strings.Contains(line, ":") {
				// New header line - split on FIRST colon only
				colonIndex := strings.Index(line, ":")
				if colonIndex > 0 && colonIndex < len(line)-1 {
					headerName := strings.TrimSpace(line[:colonIndex])
					headerValue := strings.TrimSpace(line[colonIndex+1:])

					// Validate header name
					// Must be non-empty, lowercase, no spaces, no invalid chars
					headerNameLower := strings.ToLower(headerName)
					if headerNameLower == "" {
						log.Printf("[StoreMessage] WARNING: Skipping header with empty name at line %d: %q\n", i+1, line)
						continue
					}
					if strings.Contains(headerNameLower, " ") {
						log.Printf("[StoreMessage] WARNING: Skipping header with space in name at line %d: %q\n", i+1, line)
						continue
					}
					// Skip lines that look malformed (e.g., just numbers or special chars)
					if len(headerNameLower) > 50 {
						log.Printf("[StoreMessage] WARNING: Skipping suspiciously long header name at line %d: %q\n", i+1, line)
						continue
					}

					currentHeader = headerNameLower

					// Store or append value (some headers may appear multiple times)
					if existingValue, exists := headers[currentHeader]; exists {
						headers[currentHeader] = existingValue + ", " + headerValue
					} else {
						headers[currentHeader] = headerValue
					}
				}
			}
		} else {
			// Body content (after empty line)
			body.WriteString(line)
			if i < len(lines)-1 {
				body.WriteString("\n")
			}
		}
	}

	bodyStr := body.String()

	// If Content-Type indicates multipart, try to extract plain text part
	contentType := headers["content-type"]
	if contentType != "" && strings.Contains(strings.ToLower(contentType), "multipart") {
		log.Printf("[StoreMessage] Detected multipart email, extracting plain text body\n")
		log.Printf("[StoreMessage] Content-Type: %s\n", contentType)

		// Extract boundary from Content-Type header
		// Content-Type might be malformed with multiple values like:
		// "multipart/alternative; boundary=\"xxx\", text/plain; charset=\"UTF-8\", text/html; charset=\"UTF-8\""
		// We need to extract just the first part (multipart/alternative) and get boundary from there

		// Take first value before comma (if multiple values)
		firstContentType := contentType
		commaIndex := strings.Index(contentType, ",")
		if commaIndex != -1 {
			firstContentType = strings.TrimSpace(contentType[:commaIndex])
			log.Printf("[StoreMessage] Content-Type has multiple values, using first: %s\n", firstContentType)
		}

		log.Printf("[StoreMessage] Parsing Content-Type: %s\n", firstContentType)

		// Find boundary in the Content-Type value
		contentTypeLower := strings.ToLower(firstContentType)
		boundaryStart := strings.Index(contentTypeLower, "boundary=")
		if boundaryStart != -1 {
			// Start after "boundary="
			boundaryStr := firstContentType[boundaryStart+9:]
			// Remove leading/trailing whitespace
			boundaryStr = strings.TrimSpace(boundaryStr)

			log.Printf("[StoreMessage] Boundary string before parsing: %q\n", boundaryStr)

			// Handle quoted boundary (boundary="value" or boundary=\"value\")
			if strings.HasPrefix(boundaryStr, "\\\"") {
				// Handle escaped quote \"
				boundaryStr = boundaryStr[2:] // Skip \"
				endQuote := strings.Index(boundaryStr, "\\\"")
				if endQuote == -1 {
					endQuote = strings.Index(boundaryStr, "\"")
				}
				if endQuote != -1 {
					boundaryStr = boundaryStr[:endQuote]
				}
			} else if strings.HasPrefix(boundaryStr, "\"") {
				// Handle regular quote "
				endQuote := strings.Index(boundaryStr[1:], "\"")
				if endQuote != -1 {
					boundaryStr = boundaryStr[1 : endQuote+1]
				}
			} else {
				// Unquoted boundary - everything up to next semicolon, comma, space, or end
				endIndex := len(boundaryStr)
				for _, char := range []string{";", ",", " ", "\t", "\n", "\r"} {
					idx := strings.Index(boundaryStr, char)
					if idx != -1 && idx < endIndex {
						endIndex = idx
					}
				}
				if endIndex < len(boundaryStr) {
					boundaryStr = boundaryStr[:endIndex]
				}
			}

			boundary := strings.TrimSpace(boundaryStr)
			// Remove any remaining quotes and escape sequences
			boundary = strings.Trim(boundary, "\"")
			boundary = strings.ReplaceAll(boundary, "\\\"", "\"")
			boundary = strings.ReplaceAll(boundary, "\\\\", "\\")

			log.Printf("[StoreMessage] Extracted boundary: %q\n", boundary)

			// Parse multipart body
			plainTextBody := extractPlainTextFromMultipart(bodyStr, boundary)
			if plainTextBody != "" && plainTextBody != bodyStr {
				log.Printf("[StoreMessage] Extracted plain text body: %d bytes\n", len(plainTextBody))
				bodyStr = plainTextBody
			} else {
				log.Printf("[StoreMessage] Could not extract plain text, using original body\n")
			}
		} else {
			log.Printf("[StoreMessage] No boundary found in Content-Type\n")
		}
	}

	log.Printf("[StoreMessage] Parsed headers count: %d, Body length: %d bytes\n", len(headers), len(bodyStr))
	if len(bodyStr) > 0 {
		// Log first 200 characters of body for debugging
		bodyPreview := bodyStr
		if len(bodyPreview) > 200 {
			bodyPreview = bodyPreview[:200] + "..."
		}
		log.Printf("[StoreMessage] Body preview: %q\n", bodyPreview)
	} else {
		log.Printf("[StoreMessage] WARNING: Body is empty after parsing!\n")
	}

	// Convert headers to JSON
	headersJSON, err := json.Marshal(headers)
	if err != nil {
		return fmt.Errorf("error marshaling headers to JSON: %v", err)
	}

	// Generate UUID for each message
	messageUID := uuid.New()

	// Store each recipient separately with the same message
	// Ensure recipient is always a full email address (username@domain), not just username
	for _, recipient := range rcptTo {
		// Validate that recipient is a full email address (contains @)
		if !strings.Contains(recipient, "@") {
			log.Printf("WARNING: Recipient '%s' is not a full email address, skipping storage\n", recipient)
			continue
		}

		log.Printf("Storing message - UID: %s, Recipient: %s (full email), Sender: %s\n",
			messageUID.String(), recipient, mailFrom)

		log.Printf("[StoreMessage] Storing - Body length: %d bytes\n", len(bodyStr))

		_, err := db.conn.Exec(
			"INSERT INTO mail (uid, recipient, sender, headers, message) VALUES ($1, $2, $3, $4, $5)",
			messageUID,
			recipient,
			mailFrom,
			headersJSON,
			bodyStr,
		)
		if err != nil {
			log.Printf("ERROR: Failed to store message for recipient %s: %v\n", recipient, err)
			return fmt.Errorf("error storing message: %v", err)
		}

		log.Printf("Successfully stored message for recipient: %s\n", recipient)

		// Generate new UUID for next recipient if multiple
		messageUID = uuid.New()
	}

	log.Printf("Stored message from %s to %v", mailFrom, rcptTo)
	return nil
}

// extractPlainTextFromMultipart extracts the plain text part from a multipart MIME message
func extractPlainTextFromMultipart(body, boundary string) string {
	if boundary == "" {
		log.Printf("[extractPlainTextFromMultipart] Empty boundary\n")
		return body
	}

	log.Printf("[extractPlainTextFromMultipart] Searching for boundary: %q\n", boundary)
	log.Printf("[extractPlainTextFromMultipart] Body length: %d bytes\n", len(body))

	// Multipart messages have parts separated by --boundary or \r\n--boundary\r\n
	// First line after boundary separator is typically blank, then headers, then blank line, then content

	// Try different boundary marker formats
	var boundaryMarker string
	boundaryFormats := []string{
		"\r\n--" + boundary + "\r\n",
		"\n--" + boundary + "\n",
		"--" + boundary + "\r\n",
		"--" + boundary + "\n",
		"\r\n--" + boundary + "\n",
		"\n--" + boundary + "\r\n",
	}

	for _, format := range boundaryFormats {
		if strings.Contains(body, format) {
			boundaryMarker = format
			break
		}
	}

	if boundaryMarker == "" {
		// Try without line endings - just the boundary itself
		if strings.Contains(body, "--"+boundary) {
			boundaryMarker = "--" + boundary
		} else {
			log.Printf("[extractPlainTextFromMultipart] Boundary marker not found in body\n")
			return body
		}
	}

	log.Printf("[extractPlainTextFromMultipart] Using boundary marker: %q\n", boundaryMarker)

	// Split by boundary marker
	parts := strings.Split(body, boundaryMarker)
	log.Printf("[extractPlainTextFromMultipart] Found %d parts\n", len(parts))

	// Also try splitting by just the boundary (in case line endings are inconsistent)
	if len(parts) == 1 {
		// Try alternative splitting
		altParts := strings.Split(body, "--"+boundary)
		if len(altParts) > 1 {
			log.Printf("[extractPlainTextFromMultipart] Using alternative boundary splitting, found %d parts\n", len(altParts))
			parts = altParts
		}
	}

	for partIndex, part := range parts {
		// Skip empty parts and closing boundary (which ends with --)
		trimmedPart := strings.TrimSpace(part)
		if trimmedPart == "" || trimmedPart == "--" {
			log.Printf("[extractPlainTextFromMultipart] Skipping empty part %d\n", partIndex)
			continue
		}

		log.Printf("[extractPlainTextFromMultipart] Processing part %d (length: %d bytes)\n", partIndex, len(part))

		// Check if this part is plain text
		partLines := strings.Split(part, "\n")
		isPlainText := false
		contentStartIndex := -1

		// Find headers and content in this part
		inPartHeaders := true
		partHeaders := make(map[string]string)
		var partContent strings.Builder

		for i, line := range partLines {
			lineTrimmed := strings.TrimSpace(line)

			if inPartHeaders {
				if lineTrimmed == "" {
					// Empty line marks end of headers, content starts next
					inPartHeaders = false
					continue
				}

				// Parse part header
				if strings.Contains(line, ":") {
					colonIndex := strings.Index(line, ":")
					if colonIndex > 0 {
						headerName := strings.ToLower(strings.TrimSpace(line[:colonIndex]))
						headerValue := strings.TrimSpace(line[colonIndex+1:])
						partHeaders[headerName] = headerValue

						// Check if this is Content-Type: text/plain
						if headerName == "content-type" && strings.Contains(strings.ToLower(headerValue), "text/plain") {
							isPlainText = true
							log.Printf("[extractPlainTextFromMultipart] Found text/plain in part %d\n", partIndex)
						}
					}
				}
			} else {
				// We're in the content section
				if contentStartIndex == -1 {
					contentStartIndex = i
				}
				partContent.WriteString(line)
				if i < len(partLines)-1 {
					partContent.WriteString("\n")
				}
			}
		}

		if isPlainText && partContent.Len() > 0 {
			// Extract plain text content
			plainText := partContent.String()
			// Remove trailing boundary markers and whitespace
			plainText = strings.TrimSpace(plainText)
			// Remove trailing -- if present (closing boundary)
			plainText = strings.TrimSuffix(plainText, "--")
			plainText = strings.TrimSpace(plainText)
			// Remove any remaining boundary markers
			plainText = strings.TrimSuffix(plainText, boundary)
			plainText = strings.TrimSpace(plainText)
			// Remove any remaining boundary markers with line endings
			for _, marker := range []string{"\r\n--" + boundary, "\n--" + boundary, "--" + boundary} {
				plainText = strings.TrimSuffix(plainText, marker)
			}
			plainText = strings.TrimSpace(plainText)

			log.Printf("[extractPlainTextFromMultipart] Extracted plain text: %d bytes\n", len(plainText))
			if len(plainText) > 0 {
				preview := plainText
				if len(preview) > 100 {
					preview = preview[:100] + "..."
				}
				log.Printf("[extractPlainTextFromMultipart] Plain text preview: %q\n", preview)
			}
			return plainText
		} else if isPlainText {
			log.Printf("[extractPlainTextFromMultipart] Part %d is plain text but content is empty\n", partIndex)
		}
	}

	log.Printf("[extractPlainTextFromMultipart] No plain text part found, returning original body\n")
	// If no plain text part found, return original body
	return body
}
