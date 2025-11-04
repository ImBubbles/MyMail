export interface User {
  id: number
  username: string
  email: string | null
}

export const useAuth = () => {
  const user = useState<User | null>('auth_user', () => null)
  const token = useState<string | null>('auth_token', () => null)
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  interface LoginDto {
    username: string
    password: string
    rememberMe?: boolean
  }

  interface RegisterDto {
    username: string
    password: string
    email?: string
  }

  interface AuthResponse {
    message: string
    user: User
    token: string
  }

  // Cookie configuration - will be updated based on rememberMe
  // Detect if we're using HTTPS (client-side check)
  const isHttps = process.client 
    ? window.location.protocol === 'https:'
    : config.public.isHttps || false

  const getCookieOptions = (rememberMe: boolean = false) => ({
    maxAge: rememberMe 
      ? 60 * 60 * 24 * 30 // 30 days if remember me
      : 60 * 60 * 24, // 1 day if not
    sameSite: 'lax' as const,
    secure: isHttps, // Set to true when using HTTPS
    path: '/',
  })

  // Initialize from cookies (use default 7 days for existing cookies)
  const cookieToken = useCookie<string | null>('auth_token', getCookieOptions(true))
  const cookieUser = useCookie<string | null>('auth_user', getCookieOptions(true))

  // Initialize auth state from cookies on load
  if (cookieToken.value) {
    token.value = cookieToken.value
  }
  if (cookieUser.value) {
    try {
      user.value = JSON.parse(cookieUser.value)
    } catch (e) {
      // Invalid user data in cookie
      cookieUser.value = null
    }
  }

  const validateToken = async (): Promise<boolean> => {
    // Try to get token from state first, then from cookie
    const tokenToValidate = token.value || cookieToken.value
    
    if (!tokenToValidate) return false

    try {
      const response = await $fetch<{ valid: boolean; user: User }>(
        `${apiBase}/auth/validate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenToValidate}`,
          },
          credentials: 'include', // Include cookies
        }
      )

      if (response.valid) {
        user.value = response.user
        token.value = tokenToValidate
        
        // Update cookies with latest data
        const cookieOpts = getCookieOptions(true) // Use longer expiration for validated tokens
        const tokenCookie = useCookie<string | null>('auth_token', cookieOpts)
        const userCookie = useCookie<string | null>('auth_user', cookieOpts)
        
        tokenCookie.value = tokenToValidate
        userCookie.value = JSON.stringify(response.user)
        return true
      }
      return false
    } catch (error) {
      clearAuth()
      return false
    }
  }

  // Function to initialize auth from cookies (called on app load)
  const initializeAuth = async () => {
    if (cookieToken.value) {
      token.value = cookieToken.value
      // Validate the token to ensure it's still valid
      if (process.client) {
        const valid = await validateToken()
        if (!valid) {
          // Token is invalid, clear everything
          clearAuth()
        }
      }
    }
  }

  const setAuth = (authData: { user: User; token: string }, rememberMe: boolean = false) => {
    user.value = authData.user
    token.value = authData.token
    
    // Set cookies with appropriate expiration
    const cookieOpts = getCookieOptions(rememberMe)
    const tokenCookie = useCookie<string | null>('auth_token', cookieOpts)
    const userCookie = useCookie<string | null>('auth_user', cookieOpts)
    
    tokenCookie.value = authData.token
    userCookie.value = JSON.stringify(authData.user)
  }

  const clearAuth = () => {
    user.value = null
    token.value = null
    
    // Clear cookies
    cookieToken.value = null
    cookieUser.value = null
  }

  const login = async (credentials: LoginDto): Promise<AuthResponse> => {
    try {
      const response = await $fetch<AuthResponse>(`${apiBase}/auth/login`, {
        method: 'POST',
        body: credentials,
        credentials: 'include', // Include cookies
      })
      
      setAuth({ user: response.user, token: response.token }, credentials.rememberMe || false)
      return response
    } catch (error: any) {
      // Handle network errors (Failed to fetch, connection refused, etc.)
      if (error.name === 'FetchError' || 
          error.message?.includes('fetch') || 
          error.message?.includes('network') ||
          error.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please check if the backend is running and the API URL is correct.')
      }
      const message = error.data?.message || error.message || 'Login failed. Please try again.'
      throw new Error(message)
    }
  }

  const register = async (data: RegisterDto): Promise<AuthResponse> => {
    try {
      const response = await $fetch<AuthResponse>(`${apiBase}/auth/register`, {
        method: 'POST',
        body: data,
        credentials: 'include', // Include cookies
      })
      
      setAuth({ user: response.user, token: response.token }, false) // Default to not remember on signup
      return response
    } catch (error: any) {
      // Handle NestJS validation errors
      if (error.data?.message) {
        throw new Error(error.data.message)
      }
      if (error.data?.message?.[0]) {
        throw new Error(error.data.message[0])
      }
      const message = error.message || 'Signup failed. Please try again.'
      throw new Error(message)
    }
  }

  const logout = () => {
    clearAuth()
    navigateTo('/')
  }

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  return {
    user: readonly(user),
    token: readonly(token),
    isAuthenticated,
    login,
    register,
    logout,
    validateToken,
    initializeAuth,
  }
}

