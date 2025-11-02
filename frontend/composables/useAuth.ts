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

  // Cookie configuration
  const cookieOptions = {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax' as const,
    secure: false, // Set to true in production with HTTPS
    path: '/',
  }

  // Initialize from cookies
  const cookieToken = useCookie<string | null>('auth_token', cookieOptions)
  const cookieUser = useCookie<string | null>('auth_user', cookieOptions)

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

  const setAuth = (authData: { user: User; token: string }) => {
    user.value = authData.user
    token.value = authData.token
    
    // Set cookies
    cookieToken.value = authData.token
    cookieUser.value = JSON.stringify(authData.user)
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
      
      setAuth({ user: response.user, token: response.token })
      return response
    } catch (error: any) {
      // Handle NestJS validation errors
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
      
      setAuth({ user: response.user, token: response.token })
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

  const validateToken = async (): Promise<boolean> => {
    if (!token.value) return false

    try {
      const response = await $fetch<{ valid: boolean; user: User }>(
        `${apiBase}/auth/validate`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token.value}`,
          },
          credentials: 'include', // Include cookies
        }
      )

      if (response.valid) {
        user.value = response.user
        // Update cookie with latest user data
        const cookieUser = useCookie<string | null>('auth_user', {
          maxAge: 60 * 60 * 24 * 7,
          sameSite: 'lax' as const,
          secure: false,
          path: '/',
        })
        cookieUser.value = JSON.stringify(response.user)
        return true
      }
      return false
    } catch (error) {
      clearAuth()
      return false
    }
  }

  return {
    user: readonly(user),
    token: readonly(token),
    isAuthenticated,
    login,
    register,
    logout,
    validateToken,
  }
}

