"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule, {
            logger: ['error', 'warn', 'log', 'debug', 'verbose'],
        });
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
        logger.log(`🚀 Application is running on: http://localhost:${port}`);
        logger.log(`📡 Frontend URL: ${frontendUrl}`);
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