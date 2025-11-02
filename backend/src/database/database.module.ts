import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Mail } from '../entities/mail.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const port = Number(configService.get<string>('DB_PORT', '5432'));
        const sslMode = configService.get<string>('DB_SSLMODE', 'disable');
        const host = configService.get<string>('DB_HOST', 'localhost');
        const username = configService.get<string>('DB_USER', 'postgres');
        const database = configService.get<string>('DB_NAME', 'postgres');
        const password = configService.get<string>('DB_PASSWORD');

        // Log connection details (without password)
        logger.log(`Connecting to PostgreSQL at ${host}:${port}`);
        logger.log(`Database: ${database}, User: ${username}`);
        logger.log(`Password set: ${password ? 'Yes (****)' : 'No'}`);
        logger.log(`SSL Mode: ${sslMode}`);

        if (!password) {
          logger.warn(
            'DB_PASSWORD is not set in .env file. Connection may fail.',
          );
          logger.error(`Failed to connect. Check:`);
          logger.error(`  1. Is PostgreSQL running?`);
          logger.error(`  2. Does password match pgAdmin4 password?`);
          logger.error(`  3. Is port ${port} correct? (pgAdmin4 might use different port)`);
        }

        return {
          type: 'postgres',
          host,
          port: Number.isNaN(port) ? 5432 : port,
          username,
          password: password ?? undefined,
          database,
          ssl:
            sslMode && sslMode !== 'disable'
              ? sslMode === 'require'
                ? { rejectUnauthorized: true }
                : { rejectUnauthorized: false }
              : false,
          entities: [User, Mail],
          synchronize: true, // In production use migrations
          logging: false,
          retryAttempts: 5,
          retryDelay: 3000, // 3 seconds
          autoLoadEntities: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

