// Nitro server plugin to configure HTTPS at runtime
// This reads certificates at runtime (same approach as backend bootstrap)
import { readFileSync } from 'fs'
import { join } from 'path'

export default defineNitroPlugin((nitroApp) => {
  const enableHttps = process.env.ENABLE_HTTPS === 'true'
  
  if (enableHttps) {
    const httpsKeyPath = process.env.HTTPS_KEY_PATH
    const httpsCertPath = process.env.HTTPS_CERT_PATH
    
    if (!httpsKeyPath || !httpsCertPath) {
      console.error('❌ HTTPS enabled but certificate paths not provided')
      return
    }
    
    try {
      // Resolve paths same way as backend
      // For production, __dirname will be in .output/server, so we need to go up
      // For relative paths, resolve from process.cwd() (frontend directory)
      const keyPath = httpsKeyPath.startsWith('/') || httpsKeyPath.match(/^[A-Z]:/)
        ? httpsKeyPath
        : join(process.cwd(), httpsKeyPath)
      const certPath = httpsCertPath.startsWith('/') || httpsCertPath.match(/^[A-Z]:/)
        ? httpsCertPath
        : join(process.cwd(), httpsCertPath)
      
      // Read certificates (same as backend)
      const key = readFileSync(keyPath)
      const cert = readFileSync(certPath)
      
      console.log('✅ HTTPS certificates loaded at runtime (server plugin)')
      // Note: HTTPS configuration is handled by Nitro config, this plugin just verifies
    } catch (error) {
      console.error('❌ Failed to read HTTPS certificate files at runtime:', error)
    }
  }
})

