import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer; // Master key for encrypting user keys

  constructor(private configService: ConfigService) {
    // Get master encryption key from environment
    const masterKey = this.configService.get<string>(
      'ENCRYPTION_MASTER_KEY',
      'default-master-key-change-in-production-32-chars!!',
    );

    // Ensure master key is exactly 32 bytes for AES-256
    this.masterKey = crypto
      .createHash('sha256')
      .update(masterKey)
      .digest();
  }

  /**
   * Generates a new encryption key for a user
   */
  generateUserKey(): string {
    // Generate a random 32-byte key
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypts a user's encryption key with the master key
   */
  encryptUserKey(userKey: string): string {
    if (!userKey) return userKey;

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      let encrypted = cipher.update(userKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and encrypted data
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new Error(`User key encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypts a user's encryption key using the master key
   */
  decryptUserKey(encryptedUserKey: string): string {
    if (!encryptedUserKey) return encryptedUserKey;

    try {
      const parts = encryptedUserKey.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted user key format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`User key decryption failed: ${error.message}`);
    }
  }

  /**
   * Derives a 32-byte key from a user's encryption key string
   */
  private deriveKey(userKey: string): Buffer {
    return crypto.createHash('sha256').update(userKey).digest();
  }

  /**
   * Encrypts text using a user's specific encryption key
   */
  encryptWithUserKey(text: string, userKey: string): string {
    if (!text || !userKey) return text;

    try {
      const userKeyBuffer = this.deriveKey(userKey);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, userKeyBuffer, iv);

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
   * Decrypts text using a user's specific encryption key
   */
  decryptWithUserKey(encryptedText: string, userKey: string): string {
    if (!encryptedText || !userKey) {
      throw new Error('Encrypted text and user key are required');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const userKeyBuffer = this.deriveKey(userKey);
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, userKeyBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

