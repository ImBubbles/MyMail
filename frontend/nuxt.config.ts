// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HTTPS configuration - requires certificate files
const enableHttps = process.env.ENABLE_HTTPS === 'true'
let httpsConfig: any = false
let nitroHttpsConfig: any = undefined

if (enableHttps) {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH
  const httpsCertPath = process.env.HTTPS_CERT_PATH
  
  if (!httpsKeyPath || !httpsCertPath) {
    throw new Error('HTTPS enabled but HTTPS_KEY_PATH and HTTPS_CERT_PATH must be provided in .env file')
  }
  
  // Resolve paths (support both relative and absolute)
  const keyPath = httpsKeyPath.startsWith('/') 
    ? httpsKeyPath 
    : join(__dirname, httpsKeyPath)
  const certPath = httpsCertPath.startsWith('/')
    ? httpsCertPath
    : join(__dirname, httpsCertPath)
  
  try {
    const certContents = {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    }
    
    httpsConfig = certContents
    nitroHttpsConfig = certContents
    console.log('✅ HTTPS certificates loaded successfully')
  } catch (error) {
    console.error('❌ Failed to read HTTPS certificate files:', error)
    throw new Error(`HTTPS enabled but cannot read certificate files. Key: ${keyPath}, Cert: ${certPath}`)
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
  nitro: {
    // HTTPS configuration for Nitro server (production mode)
    // Nitro expects file paths, not buffer contents
    ...(enableHttps && process.env.HTTPS_KEY_PATH && process.env.HTTPS_CERT_PATH ? {
      https: {
        key: process.env.HTTPS_KEY_PATH.startsWith('/') 
          ? process.env.HTTPS_KEY_PATH 
          : join(__dirname, process.env.HTTPS_KEY_PATH),
        cert: process.env.HTTPS_CERT_PATH.startsWith('/')
          ? process.env.HTTPS_CERT_PATH
          : join(__dirname, process.env.HTTPS_CERT_PATH),
      }
    } : {}) as any,
  },
  // Nitro dev server port (for npm run start)
  // Note: Production port is set via PORT environment variable or defaults to 443 for HTTPS
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
