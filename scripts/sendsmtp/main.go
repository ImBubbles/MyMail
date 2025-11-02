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
		// Resolve MX records for the domain
		mxRecords, err := net.LookupMX(domain)
		if err != nil {
			log.Fatalf("Error resolving MX records for %s: %v\n", domain, err)
		}

		if len(mxRecords) == 0 {
			log.Fatalf("Error: no MX records found for domain %s\n", domain)
		}

		// Sort MX records by priority (lower priority number = higher priority)
		sort.Slice(mxRecords, func(i, j int) bool {
			return mxRecords[i].Pref < mxRecords[j].Pref
		})

		// Try to connect to MX servers in priority order
		var sent bool
		var lastErr error
		for _, mx := range mxRecords {
			host := strings.TrimSuffix(mx.Host, ".")
			addr := net.JoinHostPort(host, "25")

			log.Printf("Connecting to MX server %s (priority %d) for domain %s...\n",
				host, mx.Pref, domain)

			conn, err := net.Dial("tcp", addr)
			if err != nil {
				lastErr = err
				log.Printf("Warning: failed to connect to %s: %v, trying next MX server...\n", addr, err)
				continue
			}

			log.Printf("Connected to %s, sending email...\n", addr)

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

			// Send email using MySMTP API
			// NewClientConnFromJSONMail handles the SMTP conversation and sends the email
			clientConn := smtp.NewClientConnFromJSONMail(conn, domainJsonMail)
			if clientConn == nil {
				conn.Close()
				lastErr = fmt.Errorf("failed to create client connection")
				log.Printf("Warning: failed to create client connection, trying next MX server...\n")
				continue
			}

			// Close connection after sending
			conn.Close()

			sent = true
			log.Printf("Email sent successfully to domain %s via %s\n", domain, host)
			break
		}

		if !sent {
			log.Fatalf("Error: failed to send email to domain %s after trying all MX servers. Last error: %v\n",
				domain, lastErr)
		}
	}

	fmt.Println("Email sent successfully to all recipients!")
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
