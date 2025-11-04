// postsmtp - SMTP server for receiving emails and storing them via backend API
//
// This server uses MySMTP library to accept incoming SMTP connections,
// validate recipients via the backend API, and store received emails via the backend API.
//
// OS Differences:
//   - On Windows, the compiled binary will be postsmtp.exe
//   - On Unix-like systems (Linux, macOS), the binary will be postsmtp
//   - Environment file (.env) loading works cross-platform via godotenv
//
// Build commands:
//   - Windows: go build -o postsmtp.exe
//   - Unix/Linux: go build -o postsmtp
//   - Cross-platform: go build (output name depends on OS)
package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"strings"

	"postsmtp/api"

	"github.com/ImBubbles/MySMTP/config"
	"github.com/ImBubbles/MySMTP/mail"
	"github.com/ImBubbles/MySMTP/server"
	"github.com/ImBubbles/MySMTP/smtp"
	"github.com/joho/godotenv"
)

type MessageHandler struct {
	apiClient *api.Client
}

func NewMessageHandler(apiClient *api.Client) *MessageHandler {
	return &MessageHandler{
		apiClient: apiClient,
	}
}

func (h *MessageHandler) HandleMessage(conn net.Conn, mailFrom string, rcptTo []string, data []byte) error {
	// Validate all recipients via backend API
	for _, recipient := range rcptTo {
		// Extract username from email (e.g., "user@domain.com" -> "user")
		parts := strings.Split(recipient, "@")
		if len(parts) == 0 {
			return fmt.Errorf("invalid recipient format: %s", recipient)
		}
		username := parts[0]

		exists, err := h.apiClient.ValidateUser(username)
		if err != nil {
			log.Printf("ERROR: Failed to validate recipient via API: %v", err)
			return fmt.Errorf("failed to validate recipient: %v", err)
		}
		if !exists {
			return fmt.Errorf("recipient username not found: %s", username)
		}
	}

	// Store the message via backend API
	if err := h.apiClient.ReceiveEmail(mailFrom, rcptTo, data); err != nil {
		log.Printf("ERROR: Failed to store email via backend API: %v", err)
		return fmt.Errorf("failed to store email: %v", err)
	}
	return nil
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Create API client for validating recipients and storing emails via backend
	apiClient := api.NewClient()

	// Get SMTP server configuration
	serverPortStr := getEnv("SMTP_SERVER_PORT", "2525")
	serverAddress := getEnv("SMTP_SERVER_ADDRESS", "0.0.0.0")

	// Convert port to uint16
	serverPort, err := strconv.ParseUint(serverPortStr, 10, 16)
	if err != nil {
		log.Fatalf("Invalid SMTP server port: %v", err)
	}

	log.Printf("Starting SMTP server on %s:%s", serverAddress, serverPortStr)
	log.Printf("Backend API URL: %s", getEnv("BACKEND_API_URL", "http://localhost:3000"))

	// Create message handler
	handler := NewMessageHandler(apiClient)

	// Create SMTP server using MySMTP library v0.0.19
	// Reference: https://github.com/ImBubbles/MySMTP
	// v0.0.19 includes latest improvements and ClientConn fixes for better connection handling
	// NOTE: There is a known issue in v0.0.19 where SMTP responses appear on the same line
	// as commands instead of on separate lines (missing CRLF). This is a library issue.
	// NewServer takes (address string, port uint16)
	smtpServer := server.NewServer(serverAddress, uint16(serverPort))

	// Create SMTP handlers
	handlers := smtp.NewHandlers()

	// Set mail handler - MailHandler processes a completed mail.Mail object
	handlers.MailHandler = func(m *mail.Mail) error {
		// Extract mailFrom, rcptTo, and data from mail.Mail object using getter methods
		mailFrom := m.GetFrom()
		rcptTo := m.GetTo()
		data := []byte(m.GetData())

		// Log received email details for debugging
		log.Printf("=== Received email ===\n")
		log.Printf("From: %s\n", mailFrom)
		log.Printf("To: %v\n", rcptTo)
		log.Printf("Data length: %d bytes\n", len(data))

		if len(data) == 0 {
			log.Printf("ERROR: Email data is empty/blank!\n")
		} else {
			// Log first 500 characters of data for debugging
			dataStr := string(data)
			if len(dataStr) > 500 {
				log.Printf("Data preview (first 500 chars): %s...\n", dataStr[:500])
			} else {
				log.Printf("Full data: %s\n", dataStr)
			}
		}
		log.Printf("======================\n")

		return handler.HandleMessage(nil, mailFrom, rcptTo, data)
	}

	// Set email exists checker - validate recipients via backend API
	handlers.EmailExistsChecker = func(email string) bool {
		// Extract username from email
		parts := strings.Split(email, "@")
		if len(parts) == 0 {
			log.Printf("EmailExistsChecker: Invalid email format: %s (returning false)\n", email)
			return false
		}
		username := parts[0]
		exists, err := handler.apiClient.ValidateUser(username)
		if err != nil {
			log.Printf("EmailExistsChecker: Error validating user %s: %v (returning false)\n", username, err)
			return false
		}
		log.Printf("EmailExistsChecker: Checking email %s -> username: %s, exists: %v\n", email, username, exists)
		return exists
	}

	// Set handlers for the server
	server.SetDefaultHandlers(handlers)

	// Get STARTTLS configuration from environment variables
	tlsEnabled := getEnvBool("SMTP_TLS_ENABLED", false)
	tlsCertFile := getEnv("SMTP_TLS_CERT_FILE", "")
	tlsKeyFile := getEnv("SMTP_TLS_KEY_FILE", "")

	// Create server configuration
	serverConfig := &config.Config{
		ServerHostname: getEnv("SMTP_SERVER_HOSTNAME", "localhost"),
		ServerPort:     uint16(serverPort),
		ServerAddress:  serverAddress,
		ServerDomain:   getEnv("SMTP_SERVER_DOMAIN", "localhost"),
		ClientHostname: getEnv("SMTP_CLIENT_HOSTNAME", "localhost"),
		Relay:          false,
		RequireTLS:     false,
		// TLS configuration for STARTTLS
		TLSEnabled:  tlsEnabled,
		TLSCertFile: tlsCertFile,
		TLSKeyFile:  tlsKeyFile,
	}

	// Start the server using Listen function
	log.Println("Starting SMTP server...")
	log.Printf("Server configuration - Hostname: %s, Domain: %s, Address: %s, Port: %d\n",
		serverConfig.ServerHostname, serverConfig.ServerDomain, serverConfig.ServerAddress, serverConfig.ServerPort)
	if serverConfig.TLSEnabled {
		log.Printf("STARTTLS enabled - Cert file: %s, Key file: %s\n", serverConfig.TLSCertFile, serverConfig.TLSKeyFile)
		if serverConfig.TLSCertFile == "" || serverConfig.TLSKeyFile == "" {
			log.Printf("WARNING: STARTTLS is enabled but certificate or key file path is missing!\n")
		}
	} else {
		log.Println("STARTTLS disabled")
	}
	log.Println("SMTP server is ready and listening for connections...")
	log.Println("Waiting for incoming connections...")
	server.Listen(smtpServer, serverConfig)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBool parses a boolean environment variable
// Returns true if the value is "true", "1", "yes", or "on" (case-insensitive)
// Returns false for any other value or if the variable is not set
func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	valueLower := strings.ToLower(strings.TrimSpace(value))
	return valueLower == "true" || valueLower == "1" || valueLower == "yes" || valueLower == "on"
}
