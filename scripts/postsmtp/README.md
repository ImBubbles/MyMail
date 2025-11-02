# PostSMTP - SMTP Server with PostgreSQL Integration

An SMTP server implementation using the MySMTP library with PostgreSQL backend for storing emails and validating recipients.

## Features

- SMTP server using MySMTP library
- PostgreSQL integration for email storage
- Recipient validation against PostgreSQL users table
- Automatic table creation
- Environment-based configuration

## Prerequisites

- Go 1.21 or later
- PostgreSQL database
- MySMTP library (github.com/ImBubbles/MySMTP)

## Installation

1. Install dependencies:
```bash
go get github.com/ImBubbles/MySMTP@v1.0.0
go get github.com/google/uuid
go get github.com/joho/godotenv
go get github.com/lib/pq
go mod tidy
```

2. Create a `.env` file based on `env.example`:
```bash
cp env.example .env
```

3. Update `.env` with your PostgreSQL credentials

## Configuration

The application uses environment variables for configuration. See `env.example` for all available options.

### PostgreSQL Configuration
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name (default: postgres)
- `DB_SSLMODE` - SSL mode (default: disable)

### SMTP Server Configuration
- `SMTP_SERVER_HOSTNAME` - Server hostname (default: localhost)
- `SMTP_SERVER_PORT` - Server port (default: 2525)
- `SMTP_SERVER_ADDRESS` - Server bind address (default: 0.0.0.0)
- `SMTP_SERVER_DOMAIN` - Server domain for EHLO responses (default: localhost)

## Database Schema

The application automatically creates the following tables:

### users table
- `id` - SERIAL PRIMARY KEY
- `username` - VARCHAR(255) UNIQUE NOT NULL
- `password` - TEXT NOT NULL
- `salt` - TEXT NOT NULL
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### mail table
- `uid` - UUID PRIMARY KEY (auto-generated)
- `recipient` - VARCHAR(255) NOT NULL
- `sender` - VARCHAR(255) NOT NULL
- `headers` - JSONB NOT NULL (all email headers stored as JSON)
- `message` - TEXT NOT NULL (email body content)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

## Usage

1. Ensure PostgreSQL is running and accessible
2. Create a `.env` file with your database credentials
3. Run the server:
```bash
go run main.go
```

The server will:
- Connect to PostgreSQL
- Create necessary tables if they don't exist
- Start listening on the configured SMTP port
- Validate recipient usernames against the `users` table
- Store incoming emails in the `mail` table with headers as JSON and message body

## How It Works

1. **Recipient Validation**: When an email is received, the server extracts the username from the recipient email address (e.g., `user@domain.com` → `user`)
2. **Username Check**: Validates that the username exists in the `users` table
3. **Email Storage**: If valid, stores the email in the `mail` table with:
   - Unique UUID for each record
   - Sender and recipient addresses
   - All email headers as JSONB (Subject, From, To, Date, etc.)
   - Complete message body

## Testing

To test the server, you can use a mail client or command-line tool to send emails:

```bash
telnet localhost 2525
```

Or use a mail client configured to use your server's hostname and port.

## Notes

- The recipient validation extracts the username (part before @) from the email address
- Only emails to valid usernames in the database are accepted
- All accepted emails are stored in the PostgreSQL database with headers as JSON
- Each mail record gets a unique UUID identifier
- Headers are stored as JSONB allowing for efficient querying of email metadata

