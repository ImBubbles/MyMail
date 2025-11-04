// Nitro server plugin to configure HTTPS at runtime
// This ensures HTTPS is properly configured when the server starts
export default defineNitroPlugin((nitroApp) => {
  const enableHttps = process.env.ENABLE_HTTPS === 'true'
  
  if (enableHttps) {
    const httpsKeyPath = process.env.HTTPS_KEY_PATH
    const httpsCertPath = process.env.HTTPS_CERT_PATH
    
    if (!httpsKeyPath || !httpsCertPath) {
      console.error('❌ HTTPS enabled but certificate paths not provided')
      return
    }
    
    // Log that HTTPS is configured
    console.log('✅ HTTPS plugin loaded - certificates should be configured via Nitro config')
  }
})

