"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const fs_1 = require("fs");
const path_1 = require("path");
const https = __importStar(require("https"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    try {
        const enableHttps = process.env.ENABLE_HTTPS === 'true';
        let httpsOptions;
        if (enableHttps) {
            const httpsKeyPath = process.env.HTTPS_KEY_PATH;
            const httpsCertPath = process.env.HTTPS_CERT_PATH;
            if (httpsKeyPath && httpsCertPath) {
                try {
                    const keyPath = httpsKeyPath.startsWith('/')
                        ? httpsKeyPath
                        : (0, path_1.join)(__dirname, '..', httpsKeyPath);
                    const certPath = httpsCertPath.startsWith('/')
                        ? httpsCertPath
                        : (0, path_1.join)(__dirname, '..', httpsCertPath);
                    httpsOptions = {
                        key: (0, fs_1.readFileSync)(keyPath),
                        cert: (0, fs_1.readFileSync)(certPath),
                    };
                    logger.log('✅ HTTPS enabled with provided certificates');
                }
                catch (error) {
                    logger.error('❌ Failed to read HTTPS certificate files:', error);
                    logger.warn('⚠️  HTTPS enabled but certificates not found. Please provide valid certificates or disable HTTPS.');
                    throw new Error('HTTPS enabled but certificates not found');
                }
            }
            else {
                logger.warn('⚠️  ENABLE_HTTPS=true but HTTPS_KEY_PATH and HTTPS_CERT_PATH not provided');
                logger.warn('⚠️  Please provide certificate paths or disable HTTPS');
                throw new Error('HTTPS enabled but certificate paths not configured');
            }
        }
        const appOptions = {
            logger: ['error', 'warn', 'log', 'debug', 'verbose'],
        };
        if (enableHttps && httpsOptions) {
            appOptions.httpsOptions = httpsOptions;
        }
        const app = await core_1.NestFactory.create(app_module_1.AppModule, appOptions);
        app.use((0, cookie_parser_1.default)());
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
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }));
        app.enableShutdownHooks();
        const port = process.env.PORT || 3000;
        await app.listen(port);
        const protocol = enableHttps ? 'https' : 'http';
        const server = app.getHttpServer();
        const isActuallyHttps = server instanceof https.Server;
        if (enableHttps && !isActuallyHttps) {
            logger.error('❌ HTTPS was enabled but server is not running HTTPS!');
            logger.error('❌ Check certificate paths and ensure certificates are valid.');
        }
        else if (enableHttps && isActuallyHttps) {
            logger.log(`✅ HTTPS is active and working`);
        }
        logger.log(`🚀 Application is running on: ${protocol}://localhost:${port}`);
        logger.log(`📡 Frontend URL: ${frontendUrl}`);
        if (enableHttps) {
            logger.log(`🔒 HTTPS enabled: ${isActuallyHttps ? 'YES' : 'NO'}`);
        }
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
    }
    catch (error) {
        logger.error('❌ Error starting the application', error);
        process.exit(1);
    }
}
bootstrap().catch((error) => {
    console.error('Fatal error during bootstrap:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map