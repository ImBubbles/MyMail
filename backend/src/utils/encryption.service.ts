import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    // Get encryption key from environment or generate a default (for development only)
    const encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-encryption-key-change-in-production-32-chars!!',
    );

    // Ensure key is exactly 32 bytes for AES-256
    this.key = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();
  }

  /**
   * Encrypts a string value
   */
  encrypt(text: string): string {
    if (!text) return text;

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and encrypted data
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted string
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        // If format doesn't match, assume it's not encrypted (for backward compatibility)
        return encryptedText;
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // If decryption fails, return original (might be unencrypted data)
      return encryptedText;
    }
  }
}

