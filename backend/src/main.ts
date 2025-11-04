import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as https from 'https';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    // HTTPS configuration
    const enableHttps = process.env.ENABLE_HTTPS === 'true';
    let httpsOptions: https.ServerOptions | undefined;

    if (enableHttps) {
      const httpsKeyPath = process.env.HTTPS_KEY_PATH;
      const httpsCertPath = process.env.HTTPS_CERT_PATH;

      if (httpsKeyPath && httpsCertPath) {
        // Use provided certificate files
        try {
          const keyPath = httpsKeyPath.startsWith('/') 
            ? httpsKeyPath 
            : join(__dirname, '..', httpsKeyPath);
          const certPath = httpsCertPath.startsWith('/')
            ? httpsCertPath
            : join(__dirname, '..', httpsCertPath);

          httpsOptions = {
            key: readFileSync(keyPath),
            cert: readFileSync(certPath),
          };
          logger.log('✅ HTTPS enabled with provided certificates');
        } catch (error) {
          logger.error('❌ Failed to read HTTPS certificate files:', error);
          logger.warn('⚠️  HTTPS enabled but certificates not found. Please provide valid certificates or disable HTTPS.');
          throw new Error('HTTPS enabled but certificates not found');
        }
      } else {
        logger.warn('⚠️  ENABLE_HTTPS=true but HTTPS_KEY_PATH and HTTPS_CERT_PATH not provided');
        logger.warn('⚠️  Please provide certificate paths or disable HTTPS');
        throw new Error('HTTPS enabled but certificate paths not configured');
      }
    }

    // Create app with HTTPS options if enabled
    const appOptions: any = {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    };
    
    if (enableHttps && httpsOptions) {
      appOptions.httpsOptions = httpsOptions;
    }
    
    const app = await NestFactory.create(AppModule, appOptions);
    
    // Enable cookie parser middleware
    app.use(cookieParser());
    
    // Enable CORS for frontend communication
    // Support both HTTP and HTTPS frontend URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const frontendUrls = frontendUrl === '*' 
      ? true 
      : frontendUrl.includes(',')
        ? frontendUrl.split(',').map(url => url.trim())
        : [frontendUrl];
    
    app.enableCors({
      origin: frontendUrls,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    });
    
    // Enable validation pipes globally
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Enable graceful shutdown
    app.enableShutdownHooks();

    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    // Verify HTTPS is actually working
    const protocol = enableHttps ? 'https' : 'http';
    const server = app.getHttpServer();
    const isActuallyHttps = server instanceof https.Server;
    
    if (enableHttps && !isActuallyHttps) {
      logger.error('❌ HTTPS was enabled but server is not running HTTPS!');
      logger.error('❌ Check certificate paths and ensure certificates are valid.');
    } else if (enableHttps && isActuallyHttps) {
      logger.log(`✅ HTTPS is active and working`);
    }
    
    logger.log(`🚀 Application is running on: ${protocol}://localhost:${port}`);
    logger.log(`📡 Frontend URL: ${frontendUrl}`);
    if (enableHttps) {
      logger.log(`🔒 HTTPS enabled: ${isActuallyHttps ? 'YES' : 'NO'}`);
    }
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.log('SIGTERM received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.log('SIGINT received, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Error starting the application', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Fatal error during bootstrap:', error);
  process.exit(1);
});
