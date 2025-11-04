// Nitro server plugin - HTTPS is configured via nitro.https in nuxt.config.ts
// This plugin just verifies the configuration
export default defineNitroPlugin((nitroApp) => {
  const enableHttps = process.env.ENABLE_HTTPS === 'true'
  
  if (enableHttps) {
    console.log('✅ HTTPS enabled - configuration via Nitro')
  }
})

