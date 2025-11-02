/// <reference types="../.nuxt/nuxt.d.ts" />
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

  const fetchEmails = async (): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      // TODO: Replace with actual backend API endpoint
      // For now, using mock data
      const config = useRuntimeConfig()
      const baseURL = config.public.apiBase || 'http://localhost:3000'
      
      // Try to fetch from backend, fallback to mock data if unavailable
      try {
        const response = await $fetch<Email[]>(`${baseURL}/api/emails`, {
          method: 'GET',
        })
        emails.value = response
      } catch (err) {
        // If backend is not available, use mock data
        console.warn('Backend not available, using mock data:', err)
        emails.value = getMockEmails()
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch emails'
      console.error('Error fetching emails:', err)
      // Use mock data on error
      emails.value = getMockEmails()
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
        body: 'Welcome to CrazyMail! Start creating emails and organizing them with tags.',
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
    if (!selectedTag.value) {
      return emails.value
    }
    return emails.value.filter(email => 
      email.tags.some(tag => tag.toLowerCase() === selectedTag.value?.toLowerCase())
    )
  })

  const allTags = computed(() => {
    const tagSet = new Set<string>()
    emails.value.forEach(email => {
      email.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  })

  const setSelectedTag = (tag: string | null) => {
    selectedTag.value = tag
  }

  return {
    emails: readonly(emails),
    loading: readonly(loading),
    error: readonly(error),
    filteredEmails,
    allTags,
    selectedTag: readonly(selectedTag),
    fetchEmails,
    setSelectedTag
  }
}
