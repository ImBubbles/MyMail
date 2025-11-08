// https://nuxt.com/docs/api/configuration/nuxt-config
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// HTTPS configuration - Matching backend approach with Vite-specific setup
const enableHttps = process.env.ENABLE_HTTPS === 'true'
let viteHttpsConfig: any = false
let nitroHttpsConfig: any = undefined

if (enableHttps) {
  const httpsKeyPath = process.env.HTTPS_KEY_PATH
  const httpsCertPath = process.env.HTTPS_CERT_PATH

  if (httpsKeyPath && httpsCertPath) {
    try {
      // Resolve certificate paths (same logic as backend)
      const keyPath = httpsKeyPath.startsWith('/') || httpsKeyPath.match(/^[A-Z]:/)
        ? httpsKeyPath 
        : join(__dirname, httpsKeyPath)
      const certPath = httpsCertPath.startsWith('/') || httpsCertPath.match(/^[A-Z]:/)
        ? httpsCertPath
        : join(__dirname, httpsCertPath)

      // Verify files exist and are readable
      readFileSync(keyPath)
      readFileSync(certPath)
      
      // According to Nuxt 4 docs, Vite accepts file paths for HTTPS certificates
      // Using file paths is the recommended approach per official documentation
      viteHttpsConfig = {
        key: keyPath,  // File path (recommended by Nuxt/Vite docs)
        cert: certPath, // File path (recommended by Nuxt/Vite docs)
      }
      
      // Configure Nitro HTTPS with Buffers (production server)
      // Nitro uses Node.js https.ServerOptions which accepts Buffers
      nitroHttpsConfig = {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
      }
      
      console.log('✅ HTTPS enabled with provided certificates')
      console.log(`   Key: ${keyPath}`)
      console.log(`   Cert: ${certPath}`)
      console.log(`   Vite: Using file paths (per Nuxt 4 docs)`)
      console.log(`   Nitro: Using Buffers (for production)`)
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
  
  // Configure devServer - Nuxt 4 development server settings
  // Port and host go here, and HTTPS can be configured here OR in vite.server.https
  devServer: {
    port: Number(process.env.PORT ?? '3001'),
    host: process.env.HOST || '0.0.0.0',
  },
  
  // Configure Vite server HTTPS (certificates only)
  // According to Nuxt 4 official docs: HTTPS certificates go in vite.server.https
  // Port and host are configured in devServer above
  vite: enableHttps ? {
    server: {
      https: viteHttpsConfig,
    },
  } : {},
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
