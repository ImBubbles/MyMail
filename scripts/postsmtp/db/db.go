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
	// Parse email to extract headers and body
	emailStr := string(data)
	lines := strings.Split(emailStr, "\n")
	
	headers := make(map[string]string)
	var body strings.Builder
	inBody := false
	var currentHeader string
	
	for i, line := range lines {
		// Check if we've reached the body (empty line separates headers from body)
		if line == "" && !inBody {
			inBody = true
			// Skip the empty line
			continue
		}
		
		if !inBody {
			// Parse headers
			if strings.Contains(line, ":") {
				// New header line
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					currentHeader = strings.TrimSpace(strings.ToLower(parts[0]))
					value := strings.TrimSpace(parts[1])
					
					// Store or append value (some headers may appear multiple times)
					if existingValue, exists := headers[currentHeader]; exists {
						headers[currentHeader] = existingValue + ", " + value
					} else {
						headers[currentHeader] = value
					}
				}
			} else if currentHeader != "" && (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) {
				// Continuation of previous header (folded header according to RFC 5322)
				headers[currentHeader] = headers[currentHeader] + " " + strings.TrimSpace(line)
			}
		} else {
			// Body content
			if i < len(lines)-1 {
				body.WriteString(line)
				body.WriteString("\n")
			} else {
				body.WriteString(line)
			}
		}
	}
	
	// Convert headers to JSON
	headersJSON, err := json.Marshal(headers)
	if err != nil {
		return fmt.Errorf("error marshaling headers to JSON: %v", err)
	}
	
	// Generate UUID for each message
	messageUID := uuid.New()
	
	// Store each recipient separately with the same message
	for _, recipient := range rcptTo {
		_, err := db.conn.Exec(
			"INSERT INTO mail (uid, recipient, sender, headers, message) VALUES ($1, $2, $3, $4, $5)",
			messageUID,
			recipient,
			mailFrom,
			headersJSON,
			body.String(),
		)
		if err != nil {
			return fmt.Errorf("error storing message: %v", err)
		}
		
		// Generate new UUID for next recipient if multiple
		messageUID = uuid.New()
	}
	
	log.Printf("Stored message from %s to %v", mailFrom, rcptTo)
	return nil
}

