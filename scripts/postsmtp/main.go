// postsmtp - SMTP server for receiving emails and storing them in PostgreSQL
//
// This server uses MySMTP library to accept incoming SMTP connections,
// validate recipients against a PostgreSQL database, and store received emails.
//
// OS Differences:
//   - On Windows, the compiled binary will be postsmtp.exe
//   - On Unix-like systems (Linux, macOS), the binary will be postsmtp
//   - Environment file (.env) loading works cross-platform via godotenv
//   - Database connections use standard PostgreSQL drivers (cross-platform)
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

	"postsmtp/db"

	"github.com/ImBubbles/MySMTP/config"
	"github.com/ImBubbles/MySMTP/mail"
	"github.com/ImBubbles/MySMTP/server"
	"github.com/ImBubbles/MySMTP/smtp"
	"github.com/joho/godotenv"
)

type MessageHandler struct {
	db *db.DB
}

func NewMessageHandler(database *db.DB) *MessageHandler {
	return &MessageHandler{db: database}
}

func (h *MessageHandler) HandleMessage(conn net.Conn, mailFrom string, rcptTo []string, data []byte) error {
	// Validate all recipients
	for _, recipient := range rcptTo {
		// Extract username from email (e.g., "user@domain.com" -> "user")
		parts := strings.Split(recipient, "@")
		if len(parts) == 0 {
			return fmt.Errorf("invalid recipient format: %s", recipient)
		}
		username := parts[0]

		if !h.db.ValidateRecipient(username) {
			return fmt.Errorf("recipient username not found: %s", username)
		}
	}

	// Store the message
	return h.db.StoreMessage(mailFrom, rcptTo, data)
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect to PostgreSQL using db package
	dbConfig := db.NewConfigFromEnv()
	database, err := db.New(dbConfig.ConnectionString())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Get SMTP server configuration
	serverPortStr := getEnv("SMTP_SERVER_PORT", "2525")
	serverAddress := getEnv("SMTP_SERVER_ADDRESS", "0.0.0.0")

	// Convert port to uint16
	serverPort, err := strconv.ParseUint(serverPortStr, 10, 16)
	if err != nil {
		log.Fatalf("Invalid SMTP server port: %v", err)
	}

	log.Printf("Starting SMTP server on %s:%s", serverAddress, serverPortStr)

	// Create message handler
	handler := NewMessageHandler(database)

	// Create SMTP server using MySMTP library v0.0.9
	// Reference: https://github.com/ImBubbles/MySMTP
	// v0.0.9 includes latest improvements and ClientConn fixes for better connection handling
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
		return handler.HandleMessage(nil, mailFrom, rcptTo, data)
	}

	// Set email exists checker - validate recipients
	handlers.EmailExistsChecker = func(email string) bool {
		// Extract username from email
		parts := strings.Split(email, "@")
		if len(parts) == 0 {
			return false
		}
		username := parts[0]
		return handler.db.ValidateRecipient(username)
	}

	// Set handlers for the server
	server.SetDefaultHandlers(handlers)

	// Create server configuration
	serverConfig := &config.Config{
		ServerHostname: getEnv("SMTP_SERVER_HOSTNAME", "localhost"),
		ServerPort:     uint16(serverPort),
		ServerAddress:  serverAddress,
		ServerDomain:   getEnv("SMTP_SERVER_DOMAIN", "localhost"),
		ClientHostname: getEnv("SMTP_CLIENT_HOSTNAME", "localhost"),
		Relay:          false,
		RequireTLS:     false,
	}

	// Start the server using Listen function
	log.Println("Starting SMTP server...")
	server.Listen(smtpServer, serverConfig)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
