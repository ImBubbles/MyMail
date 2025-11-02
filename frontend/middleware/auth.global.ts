export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, validateToken } = useAuth()

  // Allow access to login (home page) and signup pages
  if (to.path === '/' || to.path === '/signup') {
    // On client side, redirect authenticated users to dashboard
    if (process.client && isAuthenticated.value) {
      const valid = await validateToken()
      if (valid) {
        return navigateTo('/dashboard')
      }
    }
    // Allow access to login/signup pages when not authenticated
    // Login page (/) is the default home page
    return
  }

  // For dashboard and all other protected routes, require authentication
  if (to.path === '/dashboard' || to.path.startsWith('/dashboard')) {
    if (!isAuthenticated.value) {
      return navigateTo('/') // Redirect to login page (home)
    }

    // Validate token on protected routes (client-side only)
    if (process.client) {
      const valid = await validateToken()
      if (!valid) {
        return navigateTo('/') // Redirect to login page (home)
      }
    }
    return
  }

  // For all other routes, require authentication
  if (!isAuthenticated.value) {
    return navigateTo('/') // Redirect to login page (home)
  }

  // Validate token on protected routes (client-side only)
  if (process.client) {
    const valid = await validateToken()
    if (!valid) {
      return navigateTo('/') // Redirect to login page (home)
    }
  }
})

