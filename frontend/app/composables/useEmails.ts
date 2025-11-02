import { readonly, computed } from 'vue'

/**
 * Composable for managing emails from the backend
 */
export interface Email {
  id: string
  subject: string
  from: string
  to: string
  cc?: string[]
  bcc?: string[]
  body: string
  date: string
  tags: string[]
  read?: boolean
}

export const useEmails = () => {
  const emails = useState<Email[]>('emails', () => [])
  const loading = useState<boolean>('emailsLoading', () => false)
  const error = useState<string | null>('emailsError', () => null)
  const selectedTag = useState<string | null>('selectedTag', () => null)
  const selectedEmail = useState<Email | null>('selectedEmail', () => null)

  const fetchEmails = async () => {
    loading.value = true
    error.value = null
    
    try {
      const config = useRuntimeConfig()
      const baseURL = config.public.apiBase || 'http://localhost:3000'
      
      // Try to fetch from backend with timeout
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 5000) // 5 second timeout
        })
        
        // Race between fetch and timeout
        const response = await Promise.race([
          $fetch<Email[]>(`${baseURL}/api/emails`, {
            method: 'GET',
            timeout: 5000,
          }).catch((err) => {
            // If fetch fails, throw to be caught by outer catch
            throw err
          }),
          timeoutPromise
        ])
        
        // If response is valid array, use it (even if empty)
        if (response && Array.isArray(response)) {
          // Validate and normalize email objects
          const normalizedEmails = response.map((email: any) => ({
            id: email.id || email.uid || String(Date.now() + Math.random()),
            subject: email.subject || email.headers?.Subject || '(No Subject)',
            from: email.from || email.sender || email.headers?.From || 'unknown@crazymail.com',
            to: email.to || email.recipient || email.headers?.To || '',
            cc: email.cc || email.headers?.['Cc'] || [],
            bcc: email.bcc || email.headers?.['Bcc'] || [],
            body: email.body || email.message || email.content || '',
            date: email.date || email.created_at || email.headers?.Date || new Date().toISOString(),
            tags: email.tags || [],
            read: email.read || false
          }))
          
          emails.value = normalizedEmails
          // If backend returned empty array, show empty state (don't use mock data)
          if (normalizedEmails.length === 0) {
            console.log('Backend returned empty email list')
          } else {
            console.log(`Loaded ${normalizedEmails.length} email(s) from backend`)
          }
        } else {
          // Invalid response format, use mock data as fallback
          console.warn('Backend returned invalid response format, using mock data. Response:', response)
          emails.value = getMockEmails()
        }
      } catch (err: any) {
        // If backend is not available or times out, use mock data
        console.warn('Backend not available, using mock data:', err?.message || err)
        emails.value = getMockEmails()
        // Clear error since we have mock data
        error.value = null
      }
    } catch (err: any) {
      console.error('Error fetching emails:', err)
      // Use mock data on error
      emails.value = getMockEmails()
      // Clear error since we have mock data
      error.value = null
    } finally {
      loading.value = false
    }
  }

  const getMockEmails = (): Email[] => {
    return [
      {
        id: '1',
        subject: 'Welcome to CrazyMail',
        from: 'system@crazymail.com',
        to: 'user@example.com',
        cc: ['admin@crazymail.com'],
        bcc: [],
        body: 'Welcome to CrazyMail! Start creating emails and organizing them with tags. How long will this go until it cant be displayed in the email card?',
        date: new Date().toISOString(),
        tags: ['welcome', 'system'],
        read: false
      },
      {
        id: '2',
        subject: 'Getting Started Guide',
        from: 'support@crazymail.com',
        to: 'user@example.com',
        cc: ['support-team@crazymail.com', 'manager@crazymail.com'],
        bcc: ['archive@crazymail.com'],
        body: 'Here are some tips to get you started with CrazyMail...',
        date: new Date(Date.now() - 86400000).toISOString(),
        tags: ['support', 'guide'],
        read: false
      },
      {
        id: '3',
        subject: 'Weekly Newsletter',
        from: 'newsletter@crazymail.com',
        to: 'user@example.com',
        cc: [],
        bcc: [],
        body: 'Check out this week\'s updates and features...',
        date: new Date(Date.now() - 172800000).toISOString(),
        tags: ['newsletter'],
        read: true
      }
    ]
  }

  const filteredEmails = computed(() => {
    if (!emails.value) {
      return []
    }
    if (!selectedTag.value) {
      return emails.value
    }
    return emails.value.filter(email => 
      email?.tags?.some(tag => tag.toLowerCase() === selectedTag.value?.toLowerCase())
    )
  })

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    if (emails.value) {
      emails.value.forEach(email => {
        if (email?.tags) {
          email.tags.forEach(tag => tagSet.add(tag))
        }
      })
    }
    return Array.from(tagSet).sort()
  })

  const setSelectedTag = (tag: string | null) => {
    selectedTag.value = tag
  }

  const setSelectedEmail = (email: Email | null) => {
    selectedEmail.value = email
    // Mark email as read when selected
    if (email && !email.read) {
      const emailIndex = emails.value.findIndex(e => e.id === email.id)
      if (emailIndex !== -1) {
        const existingEmail = emails.value[emailIndex]
        if (existingEmail) {
          emails.value[emailIndex] = {
            ...existingEmail,
            read: true
          }
        }
      }
    }
  }

  return {
    emails: readonly(emails),
    loading: readonly(loading),
    error: readonly(error),
    filteredEmails,
    allTags,
    selectedTag: readonly(selectedTag),
    selectedEmail: readonly(selectedEmail),
    fetchEmails,
    setSelectedTag,
    setSelectedEmail
  }
}
