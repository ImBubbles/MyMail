import { Injectable } from '@nestjs/common';
import * as openpgp from 'openpgp';
import { EncryptionService } from './encryption.service';

@Injectable()
export class PgpService {
  constructor(private encryptionService: EncryptionService) {}

  /**
   * Generates a new PGP key pair for a user
   */
  async generateKeyPair(userEmail: string, userId: number): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    const { privateKey, publicKey } = await openpgp.generateKey({
      type: 'ecc',
      curve: 'ed25519' as any, // Use ed25519 curve for encryption/signing
      userIDs: [{ name: userEmail, email: userEmail }],
      format: 'armored',
    });

    return {
      publicKey: publicKey,
      privateKey: privateKey,
    };
  }

  /**
   * Encrypts a message using a recipient's public key
   */
  async encryptMessage(
    message: string,
    recipientPublicKey: string,
  ): Promise<string> {
    const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });

    const encrypted = await openpgp.encrypt({
      message: await openpgp.createMessage({ text: message }),
      encryptionKeys: publicKey,
    });

    return encrypted as string;
  }

  /**
   * Decrypts a message using a user's private key
   * Returns the original message if it's not PGP encrypted
   */
  async decryptMessage(
    encryptedMessage: string,
    privateKeyArmored: string,
    passphrase?: string,
  ): Promise<string> {
    // Check if message is PGP encrypted (starts with PGP armor header)
    if (!encryptedMessage.includes('-----BEGIN PGP MESSAGE-----')) {
      // Message is not encrypted, return as-is
      return encryptedMessage;
    }

    try {
      const privateKey = await openpgp.readPrivateKey({
        armoredKey: privateKeyArmored,
      });

      // If passphrase is provided, decrypt the private key
      let decryptedPrivateKey = privateKey;
      if (passphrase) {
        decryptedPrivateKey = await openpgp.decryptKey({
          privateKey,
          passphrase,
        });
      }

      const message = await openpgp.readMessage({
        armoredMessage: encryptedMessage,
      });

      const { data: decrypted } = await openpgp.decrypt({
        message,
        decryptionKeys: decryptedPrivateKey,
      });

      return decrypted as string;
    } catch (error) {
      // If decryption fails, return original message (might be unencrypted or corrupted)
      throw new Error(`Failed to decrypt PGP message: ${error.message}`);
    }
  }

  /**
   * Encrypts a user's private key with their encryption key (for storage)
   */
  encryptPrivateKey(privateKey: string, userEncryptionKey: string): string {
    return this.encryptionService.encryptWithUserKey(privateKey, userEncryptionKey);
  }

  /**
   * Decrypts a user's private key using their encryption key
   */
  decryptPrivateKey(encryptedPrivateKey: string, userEncryptionKey: string): string {
    return this.encryptionService.decryptWithUserKey(encryptedPrivateKey, userEncryptionKey);
  }
}

