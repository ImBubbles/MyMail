// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HTTPS configuration
const enableHttps = process.env.ENABLE_HTTPS === 'true'
let httpsConfig: any = false

if (enableHttps) {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH
  const httpsCertPath = process.env.HTTPS_CERT_PATH
  
  if (httpsKeyPath && httpsCertPath) {
    // Use provided certificate files
    try {
      httpsConfig = {
        key: readFileSync(join(__dirname, httpsKeyPath)),
        cert: readFileSync(join(__dirname, httpsCertPath)),
      }
    } catch (error) {
      console.warn('Failed to read HTTPS certificate files, will auto-generate:', error)
      // Auto-generate self-signed certificate
      httpsConfig = true
    }
  } else {
    // Auto-generate self-signed certificate for development
    httpsConfig = true
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/fonts', '@nuxtjs/tailwindcss'],
  devServer: {
    port: Number(process.env.PORT ?? (enableHttps ? '443' : '3001')),
    https: httpsConfig,
  },
  runtimeConfig: {
    // Private keys (only available on server-side)
    isHttps: enableHttps,
    // Public keys (exposed to client-side)
    public: {
      // Auto-detect HTTPS for API base URL if not explicitly set
      // If API_BASE_URL or NUXT_PUBLIC_API_BASE_URL is set, use it
      // Otherwise, construct from current hostname and HTTPS status
      apiBase: process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_BASE_URL || undefined,
      isHttps: enableHttps,
    }
  }
})
