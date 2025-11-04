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
      curve: 'curve25519',
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
   */
  async decryptMessage(
    encryptedMessage: string,
    privateKeyArmored: string,
    passphrase?: string,
  ): Promise<string> {
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

