// sendsmtp - A binary to send email via JSON using MySMTP API directly
//
// JSONMail struct format:
//
//	{
//	  "from": "sender@example.com",           // Required: sender email address
//	  "to": ["recipient@example.com"],         // Required: array of recipient email addresses (at least one of to/cc/bcc required)
//	  "cc": ["cc@example.com"],                // Optional: array of CC recipients
//	  "bcc": ["bcc@example.com"],              // Optional: array of BCC recipients
//	  "subject": "Email Subject",              // Optional: email subject
//	  "body": "Email body content",            // Optional: email body/content
//	  "headers": {                             // Optional: custom headers as key-value pairs
//	    "X-Custom-Header": "value"
//	  }
//	}
//
// Usage:
//
//	sendsmtp -json '{"from":"sender@example.com","to":["recipient@example.com"],"subject":"Test","body":"Hello"}'
//	echo '{"from":"sender@example.com","to":["recipient@example.com"]}' | sendsmtp
//	sendsmtp < email.json
//
// The application uses MySMTP API to send emails directly to recipient mail servers
// by resolving MX records and connecting to the appropriate SMTP servers.
package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/ImBubbles/MySMTP/mail"
	"github.com/ImBubbles/MySMTP/smtp"
)

func main() {
	var (
		jsonArg = flag.String("json", "", "JSON string conforming to JSONMail struct")
	)
	flag.Parse()

	// Get JSON input
	var jsonStr string
	if *jsonArg != "" {
		// Use command-line argument
		jsonStr = *jsonArg
	} else if len(flag.Args()) > 0 {
		// Use first positional argument
		jsonStr = strings.Join(flag.Args(), " ")
	} else {
		// Read from stdin
		scanner := bufio.NewScanner(os.Stdin)
		var lines []string
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		if err := scanner.Err(); err != nil {
			log.Fatalf("Error reading from stdin: %v\n", err)
		}
		jsonStr = strings.Join(lines, "\n")
	}

	if jsonStr == "" {
		log.Fatal("No JSON input provided. Use -json flag, provide as argument, or pipe via stdin.\n")
	}

	// Parse JSON to verify it's valid
	jsonMail, err := mail.ParseJSONMail(jsonStr)
	if err != nil {
		log.Fatalf("Error parsing JSON: %v\n", err)
	}

	// Validate required fields
	if jsonMail.From == "" {
		log.Fatal("Error: 'from' field is required\n")
	}
	if len(jsonMail.To) == 0 && len(jsonMail.CC) == 0 && len(jsonMail.BCC) == 0 {
		log.Fatal("Error: at least one recipient is required (to, cc, or bcc)\n")
	}

	// Collect all recipients (to, cc, bcc) and group by domain
	allRecipients := append([]string{}, jsonMail.To...)
	allRecipients = append(allRecipients, jsonMail.CC...)
	allRecipients = append(allRecipients, jsonMail.BCC...)

	// Group recipients by domain
	recipientsByDomain := make(map[string][]string)
	for _, recipient := range allRecipients {
		parts := strings.Split(recipient, "@")
		if len(parts) != 2 {
			log.Fatalf("Error: invalid email address format: %s\n", recipient)
		}
		domain := parts[1]
		recipientsByDomain[domain] = append(recipientsByDomain[domain], recipient)
	}

	log.Printf("Sending email from %s to %d recipient(s) across %d domain(s)...\n",
		jsonMail.From, len(allRecipients), len(recipientsByDomain))

	// Send to each domain by resolving MX records and connecting directly
	for domain, recipients := range recipientsByDomain {
		err := sendToDomain(domain, recipients, jsonMail)
		if err != nil {
			log.Fatalf("Error: failed to send email to domain %s: %v\n", domain, err)
		}
	}

	fmt.Println("Email sent successfully to all recipients!")
}

// sendToDomain attempts to send email to recipients in a specific domain
func sendToDomain(domain string, recipients []string, jsonMail *mail.JSONMail) error {
	// Resolve MX records for the domain
	mxRecords, err := net.LookupMX(domain)
	if err != nil {
		return fmt.Errorf("error resolving MX records for %s: %v", domain, err)
	}

	if len(mxRecords) == 0 {
		return fmt.Errorf("no MX records found for domain %s", domain)
	}

	// Sort MX records by priority (lower priority number = higher priority)
	sort.Slice(mxRecords, func(i, j int) bool {
		return mxRecords[i].Pref < mxRecords[j].Pref
	})

	// Create a modified JSONMail with only recipients for this domain
	domainJsonMail := &mail.JSONMail{
		From:    jsonMail.From,
		To:      []string{},
		CC:      []string{},
		BCC:     []string{},
		Subject: jsonMail.Subject,
		Body:    jsonMail.Body,
		Headers: jsonMail.Headers,
	}

	// Validate and log email content before sending
	if domainJsonMail.Body == "" {
		log.Printf("WARNING: Email body is empty for domain %s!\n", domain)
	}
	if domainJsonMail.Subject == "" {
		log.Printf("WARNING: Email subject is empty for domain %s!\n", domain)
	}
	log.Printf("Preparing to send email - From: %s, Body length: %d, Subject: %s\n",
		domainJsonMail.From, len(domainJsonMail.Body), domainJsonMail.Subject)

	// Add recipients for this domain to the appropriate field
	// Maintain original To/CC/BCC structure for proper SMTP handling
	for _, recipient := range recipients {
		if contains(jsonMail.To, recipient) {
			domainJsonMail.To = append(domainJsonMail.To, recipient)
		} else if contains(jsonMail.CC, recipient) {
			domainJsonMail.CC = append(domainJsonMail.CC, recipient)
		} else if contains(jsonMail.BCC, recipient) {
			domainJsonMail.BCC = append(domainJsonMail.BCC, recipient)
		}
	}

	// Try to connect to ALL MX servers in priority order
	// We'll attempt each one until we find a server that successfully accepts the email
	var lastErr error
	var attemptedServers []string

	log.Printf("Found %d MX server(s) for domain %s, will try all valid SMTP domains\n", len(mxRecords), domain)

	for i, mx := range mxRecords {
		host := strings.TrimSuffix(mx.Host, ".")
		addr := net.JoinHostPort(host, "25")
		attemptedServers = append(attemptedServers, fmt.Sprintf("%s (priority %d)", host, mx.Pref))

		log.Printf("[%d/%d] Attempting MX server %s (priority %d) for domain %s...\n",
			i+1, len(mxRecords), host, mx.Pref, domain)

		// Dial with timeout to prevent hanging
		dialer := &net.Dialer{
			Timeout: 10 * time.Second,
		}
		conn, err := dialer.Dial("tcp", addr)
		if err != nil {
			lastErr = fmt.Errorf("failed to connect to %s: %v", addr, err)
			log.Printf("Warning: %v, trying next MX server...\n", lastErr)
			continue
		}

		// Set read and write timeouts to prevent hanging
		readDeadline := time.Now().Add(30 * time.Second)
		writeDeadline := time.Now().Add(30 * time.Second)
		conn.SetReadDeadline(readDeadline)
		conn.SetWriteDeadline(writeDeadline)

		log.Printf("Connected to %s, attempting SMTP conversation...\n", addr)
		log.Printf("Email details - From: %s, To: %v, CC: %v, BCC: %v, Subject: %s\n",
			domainJsonMail.From, domainJsonMail.To, domainJsonMail.CC, domainJsonMail.BCC, domainJsonMail.Subject)
		log.Printf("Email body length: %d bytes, Body preview: %s\n",
			len(domainJsonMail.Body),
			func() string {
				if len(domainJsonMail.Body) > 100 {
					return domainJsonMail.Body[:100] + "..."
				}
				return domainJsonMail.Body
			}())

		// Send email using MySMTP API v0.0.15 (includes ClientConn fixes and improvements)
		// NewClientConnFromJSONMail handles the SMTP conversation and sends the email
		// The connection must remain open during the SMTP conversation
		// The ClientConn performs HELO, MAIL FROM, RCPT TO, DATA, and QUIT synchronously
		// With v0.0.15, the ClientConn includes latest improvements and better connection handling

		// Attempt SMTP conversation - connection must stay open until conversation completes
		// NewClientConnFromJSONMail should perform the full SMTP conversation synchronously
		// Log detailed information about what we're sending
		log.Printf("Creating ClientConn with email data:\n")
		log.Printf("  From: %s\n", domainJsonMail.From)
		log.Printf("  To: %v\n", domainJsonMail.To)
		log.Printf("  CC: %v\n", domainJsonMail.CC)
		log.Printf("  BCC: %v\n", domainJsonMail.BCC)
		log.Printf("  Subject: %s\n", domainJsonMail.Subject)
		log.Printf("  Body: %q (length: %d)\n",
			func() string {
				if len(domainJsonMail.Body) > 50 {
					return domainJsonMail.Body[:50] + "..."
				}
				return domainJsonMail.Body
			}(),
			len(domainJsonMail.Body))
		log.Printf("  Headers: %v\n", domainJsonMail.Headers)

		log.Printf("Initiating SMTP conversation via NewClientConnFromJSONMail...\n")
		clientConn, smtpErr := smtp.NewClientConnFromJSONMail(conn, domainJsonMail)

		// Log the result before checking errors
		if smtpErr != nil {
			log.Printf("ERROR: SMTP error during conversation: %v\n", smtpErr)
			log.Printf("ERROR DETAILS: %+v\n", smtpErr)
		}
		if clientConn == nil {
			log.Printf("ERROR: ClientConn is nil after creation\n")
		} else {
			log.Printf("ClientConn created successfully\n")
			// Check if ClientConn has connection info
			if connInfo := clientConn.GetConn(); connInfo != nil {
				log.Printf("ClientConn has underlying connection\n")
			}
		}

		// Only close connection after SMTP conversation completes (success or failure)
		// ClientConn handles QUIT command which closes the connection, but we ensure cleanup
		defer func() {
			if conn != nil {
				log.Printf("Cleaning up: closing connection to %s\n", addr)
				conn.Close()
			}
		}()

		if clientConn == nil || smtpErr != nil {
			if smtpErr != nil {
				lastErr = fmt.Errorf("failed to create client connection or SMTP conversation failed: %v", smtpErr)
			} else {
				lastErr = fmt.Errorf("failed to create client connection or SMTP conversation failed")
			}
			log.Printf("Warning: SMTP conversation failed on %s: %v, trying next MX server...\n", addr, lastErr)
			continue
		}

		// If we get here, the ClientConn was created successfully
		// The ClientConn manages the SMTP conversation synchronously during creation
		// After NewClientConnFromJSONMail returns successfully, the email should be sent
		// The SMTP conversation (HELO, MAIL FROM, RCPT TO, DATA, QUIT) is complete
		log.Printf("Email sent successfully to domain %s via %s (priority %d)\n", domain, host, mx.Pref)
		log.Printf("Successfully used %s out of %d available MX server(s)\n", host, len(mxRecords))
		return nil // Success!
	}

	// If we reach here, all MX servers failed
	log.Printf("All %d MX server(s) failed for domain %s\n", len(mxRecords), domain)
	log.Printf("Attempted servers: %s\n", strings.Join(attemptedServers, ", "))
	return fmt.Errorf("failed to send email to domain %s after trying all %d MX server(s). Last error: %v",
		domain, len(mxRecords), lastErr)
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
