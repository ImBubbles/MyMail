// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HTTPS configuration - EXACTLY matching backend approach
const enableHttps = process.env.ENABLE_HTTPS === 'true'
let devServerHttpsConfig: any = false
let nitroHttpsConfig: any = undefined

if (enableHttps) {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH
  const httpsCertPath = process.env.HTTPS_CERT_PATH

  // Backend checks: if (httpsKeyPath && httpsCertPath)
  if (httpsKeyPath && httpsCertPath) {
    // Use provided certificate files
    try {
      // Backend path resolution: join(__dirname, '..', httpsKeyPath)
      // Backend's __dirname is in dist/, so join(__dirname, '..') = backend/
      // For frontend, __dirname is where nuxt.config.ts is (frontend/)
      // So we resolve relative to __dirname (frontend/), not __dirname/..
      // This way ../certs resolves to frontend/../certs = ~/certs
      const keyPath = httpsKeyPath.startsWith('/') || httpsKeyPath.match(/^[A-Z]:/)
        ? httpsKeyPath 
        : join(__dirname, httpsKeyPath)
      const certPath = httpsCertPath.startsWith('/') || httpsCertPath.match(/^[A-Z]:/)
        ? httpsCertPath
        : join(__dirname, httpsCertPath)

      // Read certificate files as Buffers (same as backend)
      const keyBuffer = readFileSync(keyPath)
      const certBuffer = readFileSync(certPath)
      
      // Use Buffers for both devServer (Vite) and Nitro
      // Vite supports Buffers, and this matches the backend approach exactly
      devServerHttpsConfig = {
        key: keyBuffer,
        cert: certBuffer,
      }
      
      nitroHttpsConfig = {
        key: keyBuffer,
        cert: certBuffer,
      }
      
      console.log('✅ HTTPS enabled with provided certificates')
      console.log(`   Key: ${keyPath}`)
      console.log(`   Cert: ${certPath}`)
    } catch (error) {
      console.error('❌ Failed to read HTTPS certificate files:', error)
      console.error('⚠️  HTTPS enabled but certificates not found. Please provide valid certificates or disable HTTPS.')
      throw new Error('HTTPS enabled but certificates not found')
    }
  } else {
    console.error('⚠️  ENABLE_HTTPS=true but HTTPS_KEY_PATH and HTTPS_CERT_PATH not provided')
    console.error('⚠️  Please provide certificate paths or disable HTTPS')
    throw new Error('HTTPS enabled but certificate paths not configured')
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/fonts', '@nuxtjs/tailwindcss'],
  devServer: {
    // Use non-privileged port (3001) even for HTTPS to avoid admin requirements on Windows
    // Port 443 requires admin privileges and can cause binding failures
    port: Number(process.env.PORT ?? '3001'),
    https: devServerHttpsConfig,
    // Host should be explicitly set for HTTPS to work properly
    host: process.env.HOST || 'localhost',
  },
  nitro: {
    // HTTPS configuration for Nitro server (production mode)
    // Backend passes: appOptions.httpsOptions = httpsOptions as any
    // Frontend passes to Nitro's https config
    ...(enableHttps && nitroHttpsConfig ? {
      https: {
        key: nitroHttpsConfig.key,
        cert: nitroHttpsConfig.cert,
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
