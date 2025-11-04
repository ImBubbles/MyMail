import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { Mail } from '../entities/mail.entity';
import { AuthModule } from '../auth/auth.module';
import { PgpService } from '../utils/pgp.service';
import { EncryptionService } from '../utils/encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mail]),
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MailController],
  providers: [MailService, PgpService, EncryptionService],
  exports: [MailService],
})
export class MailModule {}

