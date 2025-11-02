// sendsmtp - A binary to send email via JSON using MySMTP library
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
//	sendsmtp -host smtp.example.com -port 587 < email.json
//	echo '{"from":"sender@example.com","to":["recipient@example.com"]}' | sendsmtp
package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"strings"

	"github.com/ImBubbles/MySMTP/mail"
	"github.com/ImBubbles/MySMTP/smtp"
)

func main() {
	var (
		smtpHost = flag.String("host", getEnvOrDefault("SMTP_HOST", "localhost"), "SMTP server host")
		smtpPort = flag.String("port", getEnvOrDefault("SMTP_PORT", "2525"), "SMTP server port")
		jsonArg  = flag.String("json", "", "JSON string conforming to JSONMail struct")
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

	// Connect to SMTP server
	addr := net.JoinHostPort(*smtpHost, *smtpPort)
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		log.Fatalf("Failed to connect to SMTP server at %s: %v\n", addr, err)
	}
	defer conn.Close()

	fmt.Printf("Connected to SMTP server at %s\n", addr)

	// Send email using MySMTP
	_, err = smtp.NewClientConnFromJSONString(conn, jsonStr)
	if err != nil {
		log.Fatalf("Error sending email: %v\n", err)
	}

	fmt.Println("Email sent successfully!")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
