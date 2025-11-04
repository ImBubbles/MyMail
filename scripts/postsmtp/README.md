# PostSMTP - SMTP Server with Backend API Integration

An SMTP server implementation using the MySMTP library that validates recipients and stores received emails via the backend API. **No direct database access** - all operations go through the backend API.

## Features

- SMTP server using MySMTP library
- Backend API integration for all operations (recipient validation and email storage)
- No direct PostgreSQL database access
- API key authentication for secure communication

## Prerequisites

- Go 1.21 or later
- Backend API running and accessible
- MySMTP library (github.com/ImBubbles/MySMTP)

## Installation

1. Install dependencies:
```bash
go get github.com/ImBubbles/MySMTP@v1.0.0
go get github.com/joho/godotenv
go mod tidy
```

2. Create a `.env` file in the postsmtp directory with the following variables:

```env
# Backend API Configuration
BACKEND_API_URL=http://localhost:3000
POSTSMTP_API_KEY=your-secure-api-key-here

# SMTP Server Configuration
SMTP_SERVER_HOSTNAME=localhost
SMTP_SERVER_PORT=2525
SMTP_SERVER_ADDRESS=0.0.0.0
SMTP_SERVER_DOMAIN=localhost
SMTP_TLS_ENABLED=false
```

## Configuration

### Backend API Configuration
**Required** for all operations (recipient validation and email storage):
- `BACKEND_API_URL` - Backend API base URL (default: http://localhost:3000)
- `POSTSMTP_API_KEY` - API key for authenticating with backend (must match `POSTSMTP_API_KEY` in backend `.env`)

### SMTP Server Configuration
- `SMTP_SERVER_HOSTNAME` - Server hostname (default: localhost)
- `SMTP_SERVER_PORT` - Server port (default: 2525)
- `SMTP_SERVER_ADDRESS` - Server bind address (default: 0.0.0.0)
- `SMTP_SERVER_DOMAIN` - Server domain for EHLO responses (default: localhost)
- `SMTP_TLS_ENABLED` - Enable STARTTLS (default: false)
- `SMTP_TLS_CERT_FILE` - TLS certificate file path (optional)
- `SMTP_TLS_KEY_FILE` - TLS key file path (optional)

## How It Works

1. **Recipient Validation**: When an email is received, the server extracts the username from the recipient email address (e.g., `user@domain.com` → `user`) and validates that the username exists by calling the backend API at `/auth/validate-user/:username`.

2. **Email Storage**: If valid, the email is sent to the backend API at `/mail/receive` endpoint with:
   - API key authentication via `X-API-Key` header
   - Email data (base64 encoded)
   - Sender and recipient information

3. **Security**: 
   - Only emails for valid usernames are accepted (validated via backend API)
   - API key authentication prevents unauthorized access
   - Backend validates recipients exist before storing
   - Prevents fraudulent emails from being stored
   - No direct database access - all operations go through the backend

## Usage

1. Ensure the backend API is running and accessible
2. Create a `.env` file with your API key
3. **Important**: Set `POSTSMTP_API_KEY` in both postsmtp `.env` and backend `.env` to the same value
4. Run the server:
```bash
go run main.go
```

Or build and run:
```bash
go build -o postsmtp.exe  # Windows
go build -o postsmtp       # Unix/Linux
./postsmtp.exe            # Windows
./postsmtp                # Unix/Linux
```

## Backend API Endpoints

The postsmtp server calls:
- **GET** `/auth/validate-user/:username` - Validates if a username exists
  - Requires `X-API-Key` header
  - Response: `{ exists: boolean, username: string }`
  
- **POST** `/mail/receive` - Stores received emails
  - Requires `X-API-Key` header
  - Request body: `{ mailFrom: string, rcptTo: string[], data: string }`
  - Response: `{ message: string, storedEmails: Array<{uid, recipient}> }`

## Security Features

1. **API Key Authentication**: Only requests with valid `X-API-Key` header can validate users or store emails
2. **Recipient Validation**: Backend validates recipients exist before storing
3. **No Direct Database Access**: All operations (validation and storage) go through the backend API
4. **Constant-time Key Comparison**: Prevents timing attacks on API key

## Testing

To test the server, you can use a mail client or command-line tool to send emails:

```bash
telnet localhost 2525
```

Or use a mail client configured to use your server's hostname and port.

## Notes

- The recipient validation extracts the username (part before @) from the email address
- Only emails to valid usernames (validated via backend API) are accepted
- All operations go through the backend API - no direct database access
- The backend API validates recipients exist before storing to prevent fraudulent emails
- API key must be set in both postsmtp and backend environment files
