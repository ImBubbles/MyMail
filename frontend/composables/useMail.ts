export interface Mail {
  uid: string
  recipient: string
  sender: string
  headers: Record<string, any>
  message: string
  createdAt: string
}

export interface MailListResponse {
  emails: Mail[]
  count: number
}

export const useMail = () => {
  const { token } = useAuth()
  const config = useRuntimeConfig()
  
  // Determine API base URL - use config if set, otherwise construct from current location
  const getApiBase = () => {
    if (config.public.apiBase) {
      return config.public.apiBase
    }
    
    // Auto-detect from current page location
    if (process.client) {
      const protocol = window.location.protocol
      const hostname = window.location.hostname
      // Use backend port 3000, or same port as frontend if custom
      const port = 3000
      return `${protocol}//${hostname}:${port}`
    }
    
    // Server-side fallback
    const protocol = config.public.isHttps ? 'https' : 'http'
    return `${protocol}://localhost:3000`
  }
  
  const apiBase = getApiBase()

  const getAuthHeaders = () => {
    if (!token.value) {
      throw new Error('Not authenticated')
    }
    return {
      Authorization: `Bearer ${token.value}`,
    }
  }

  const getInbox = async (): Promise<MailListResponse> => {
    try {
      const response = await $fetch<MailListResponse>(`${apiBase}/mail/inbox`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include', // Include cookies
      })
      return response
    } catch (error: any) {
      const message = error.data?.message || error.message || 'Failed to fetch inbox'
      throw new Error(message)
    }
  }

  const getSent = async (): Promise<MailListResponse> => {
    try {
      const response = await $fetch<MailListResponse>(`${apiBase}/mail/sent`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include', // Include cookies
      })
      return response
    } catch (error: any) {
      const message = error.data?.message || error.message || 'Failed to fetch sent emails'
      throw new Error(message)
    }
  }

  const searchEmails = async (query: string): Promise<MailListResponse> => {
    try {
      if (!query || query.trim() === '') {
        return { emails: [], count: 0 }
      }
      const response = await $fetch<MailListResponse>(`${apiBase}/mail/search`, {
        method: 'GET',
        headers: getAuthHeaders(),
        query: { q: query },
        credentials: 'include', // Include cookies
      })
      return response
    } catch (error: any) {
      const message = error.data?.message || error.message || 'Failed to search emails'
      throw new Error(message)
    }
  }

  const getEmailById = async (uid: string): Promise<Mail> => {
    try {
      const response = await $fetch<Mail>(`${apiBase}/mail/${uid}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include', // Include cookies
      })
      return response
    } catch (error: any) {
      const message = error.data?.message || error.message || 'Failed to fetch email'
      throw new Error(message)
    }
  }

  interface SendMailDto {
    recipient: string
    subject: string
    message: string
    cc?: string[]
    bcc?: string[]
  }

  interface SendMailResponse {
    message: string
    uid: string
    mail: {
      uid: string
      recipient: string
      sender: string
      subject: string
      createdAt: string
    }
  }

  const sendEmail = async (data: SendMailDto): Promise<SendMailResponse> => {
    try {
      const response = await $fetch<SendMailResponse>(`${apiBase}/mail/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include', // Include cookies
        body: data,
      })
      return response
    } catch (error: any) {
      const message = error.data?.message || error.message || 'Failed to send email'
      throw new Error(message)
    }
  }

  return {
    getInbox,
    getSent,
    searchEmails,
    getEmailById,
    sendEmail,
  }
}
