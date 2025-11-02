/**
 * Utility functions for parsing and displaying email content
 */

/**
 * Extracts plain text or HTML from a multipart email body
 */
export function extractFromMultipart(
  message: string,
  contentType: string | undefined | null
): string {
  if (!message || !contentType) {
    return message || ''
  }

  // Check if it's a multipart email
  const contentTypeLower = contentType.toLowerCase()
  if (!contentTypeLower.includes('multipart')) {
    return message
  }

  // Extract boundary from Content-Type header
  // Handle malformed headers like: multipart/alternative; boundary=\"xxx\", text/plain; charset=\"UTF-8\", ...
  // Take first value before comma
  const firstContentType = contentType.includes(',') 
    ? contentType.split(',')[0].trim()
    : contentType

  // Format: multipart/alternative; boundary="xxx" or boundary=xxx or boundary=\"xxx\"
  // Handle escaped quotes: boundary=\"xxx\" or boundary="xxx"
  // Find boundary= and extract value
  const boundaryStart = firstContentType.toLowerCase().indexOf('boundary=')
  if (boundaryStart === -1) {
    // No boundary found, return message as-is
    return message
  }
  
  // Extract everything after boundary=
  let boundaryStr = firstContentType.substring(boundaryStart + 9).trim()
  
  // Handle quoted boundary (with or without escapes)
  let boundary = ''
  if (boundaryStr.startsWith('\\"') || boundaryStr.startsWith('"')) {
    // Quoted boundary - find closing quote
    const startQuote = boundaryStr.startsWith('\\"') ? 2 : 1
    const endQuote = boundaryStr.indexOf('"', startQuote)
    if (endQuote !== -1) {
      boundary = boundaryStr.substring(startQuote, endQuote)
    } else {
      // No closing quote, take everything up to comma or semicolon
      const commaIndex = boundaryStr.indexOf(',')
      const semicolonIndex = boundaryStr.indexOf(';')
      const endIndex = Math.min(
        commaIndex !== -1 ? commaIndex : Infinity,
        semicolonIndex !== -1 ? semicolonIndex : Infinity
      )
      boundary = boundaryStr.substring(startQuote, endIndex < Infinity ? endIndex : undefined).trim()
    }
  } else {
    // Unquoted boundary - take everything up to comma, semicolon, or space
    const commaIndex = boundaryStr.indexOf(',')
    const semicolonIndex = boundaryStr.indexOf(';')
    const spaceIndex = boundaryStr.indexOf(' ')
    const endIndex = Math.min(
      commaIndex !== -1 ? commaIndex : Infinity,
      semicolonIndex !== -1 ? semicolonIndex : Infinity,
      spaceIndex !== -1 ? spaceIndex : Infinity
    )
    boundary = boundaryStr.substring(0, endIndex < Infinity ? endIndex : undefined).trim()
  }
  
  // Remove any remaining escape sequences
  boundary = boundary.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  
  if (!boundary) {
    // No boundary found, return message as-is
    return message
  }
  
  // Try different boundary marker formats
  const boundaryMarkers = [
    `\r\n--${boundary}\r\n`,
    `\n--${boundary}\n`,
    `--${boundary}\r\n`,
    `--${boundary}\n`,
    `--${boundary}`,
  ]

  let parts: string[] = []
  let foundMarker = false

  for (const marker of boundaryMarkers) {
    if (message.includes(marker)) {
      parts = message.split(marker)
      foundMarker = true
      break
    }
  }

  // If no marker found, try splitting by just the boundary
  if (!foundMarker && message.includes(`--${boundary}`)) {
    parts = message.split(`--${boundary}`)
    foundMarker = true
  }

  if (!foundMarker || parts.length < 2) {
    // Couldn't parse multipart, return original message
    return message
  }

  // Find the plain text or HTML part
  let plainText = ''
  let htmlText = ''

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()
    
    // Skip empty parts and closing boundary
    if (!part || part === '--') {
      continue
    }

    // Split part into headers and content
    const lines = part.split(/\r?\n/)
    let inHeaders = true
    let partContentType = ''
    let contentStartIndex = -1

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j].trim()

      if (inHeaders) {
        if (!line) {
          // Empty line marks end of headers
          inHeaders = false
          contentStartIndex = j + 1
          continue
        }

        // Check for Content-Type header
        if (line.toLowerCase().startsWith('content-type:')) {
          const colonIndex = line.indexOf(':')
          if (colonIndex !== -1) {
            partContentType = line.substring(colonIndex + 1).trim().toLowerCase()
          }
        }
      }
    }

    // Extract content (everything after headers)
    if (contentStartIndex > 0 && contentStartIndex < lines.length) {
      const content = lines.slice(contentStartIndex).join('\n').trim()
      
      // Remove trailing boundary markers
      let cleanContent = content.replace(/\r?\n--$/, '').replace(/--$/, '').trim()

      if (partContentType.includes('text/plain')) {
        plainText = cleanContent
      } else if (partContentType.includes('text/html')) {
        htmlText = cleanContent
      }
    }
  }

  // Prefer HTML if available, otherwise use plain text
  if (htmlText) {
    return htmlText
  }

  if (plainText) {
    return plainText
  }

  // If no parts found, return original message
  return message
}

/**
 * Gets the display text for an email message
 * Handles multipart emails and extracts the appropriate content
 */
export function getEmailDisplayText(email: {
  message: string
  headers?: Record<string, any>
}): string {
  if (!email.message) {
    return ''
  }

  // Get Content-Type from headers
  const contentType = email.headers?.['content-type'] || 
                      email.headers?.['Content-Type'] ||
                      email.headers?.['CONTENT-TYPE']

  // Extract content from multipart if needed
  const displayText = extractFromMultipart(email.message, contentType)

  // Strip HTML tags if it's HTML content (for preview)
  if (contentType?.toLowerCase().includes('text/html') || displayText.includes('<html') || displayText.includes('<body')) {
    // Remove HTML tags for plain text preview
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = displayText
    return tempDiv.textContent || tempDiv.innerText || displayText
  }

  return displayText
}

/**
 * Gets the full HTML content for rendering
 */
export function getEmailHTMLContent(email: {
  message: string
  headers?: Record<string, any>
}): string | null {
  if (!email.message) {
    return null
  }

  const contentType = email.headers?.['content-type'] || 
                      email.headers?.['Content-Type'] ||
                      email.headers?.['CONTENT-TYPE']

  const displayText = extractFromMultipart(email.message, contentType)

  // Check if it's HTML content
  if (contentType?.toLowerCase().includes('text/html') || displayText.includes('<html') || displayText.includes('<body')) {
    return displayText
  }

  // If plain text, convert to HTML (preserve line breaks)
  return displayText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

/**
 * Checks if an email is multipart
 */
export function isMultipartEmail(email: {
  headers?: Record<string, any>
}): boolean {
  const contentType = email.headers?.['content-type'] || 
                      email.headers?.['Content-Type'] ||
                      email.headers?.['CONTENT-TYPE']

  if (!contentType) {
    return false
  }

  return contentType.toLowerCase().includes('multipart')
}

