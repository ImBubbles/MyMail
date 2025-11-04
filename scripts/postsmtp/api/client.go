package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

type Client struct {
	baseURL string
	apiKey  string
	client  *http.Client
}

type ReceiveEmailRequest struct {
	MailFrom string   `json:"mailFrom"`
	RcptTo   []string `json:"rcptTo"`
	Data     string   `json:"data"` // Base64 encoded email data
}

type ReceiveEmailResponse struct {
	Message      string `json:"message"`
	StoredEmails []struct {
		UID       string `json:"uid"`
		Recipient string `json:"recipient"`
	} `json:"storedEmails"`
}

func NewClient() *Client {
	baseURL := getEnv("BACKEND_API_URL", "http://localhost:3000")
	apiKey := getEnv("POSTSMTP_API_KEY", "")

	if apiKey == "" {
		log.Fatal("POSTSMTP_API_KEY environment variable is required")
	}

	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ValidateUser checks if a username exists via the backend API
func (c *Client) ValidateUser(username string) (bool, error) {
	url := fmt.Sprintf("%s/auth/validate-user/%s", c.baseURL, username)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("API error response: %s", string(body))
		return false, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var response struct {
		Exists   bool   `json:"exists"`
		Username string `json:"username"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return false, fmt.Errorf("failed to parse response: %v", err)
	}

	return response.Exists, nil
}

func (c *Client) ReceiveEmail(mailFrom string, rcptTo []string, data []byte) error {
	// Encode email data as base64
	dataBase64 := base64.StdEncoding.EncodeToString(data)

	requestBody := ReceiveEmailRequest{
		MailFrom: mailFrom,
		RcptTo:   rcptTo,
		Data:     dataBase64,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %v", err)
	}

	url := fmt.Sprintf("%s/mail/receive", c.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	log.Printf("Sending email to backend API: %s", url)
	log.Printf("From: %s, To: %v", mailFrom, rcptTo)

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("API error response: %s", string(body))
		return fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	var response ReceiveEmailResponse
	if err := json.Unmarshal(body, &response); err != nil {
		log.Printf("Warning: Failed to parse response JSON: %v", err)
		log.Printf("Response body: %s", string(body))
		// Still consider it successful if status code was OK
		return nil
	}

	log.Printf("Successfully stored email via backend API: %s", response.Message)
	for _, stored := range response.StoredEmails {
		log.Printf("  - Stored for recipient %s (UID: %s)", stored.Recipient, stored.UID)
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

