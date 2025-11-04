import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { platform } from 'os';
import { Mail } from '../entities/mail.entity';
import { SendMailDto } from './dto/send-mail.dto';
import { ReceiveEmailDto } from './dto/receive-email.dto';
import { AuthService } from '../auth/auth.service';
import { PgpService } from '../utils/pgp.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly sendsmtpPath: string;

  constructor(
    @InjectRepository(Mail)
    private mailRepository: Repository<Mail>,
    private authService: AuthService,
    private pgpService: PgpService,
  ) {
    // Resolve path to sendsmtp executable
    // From backend/src/mail/mail.service.ts (compiled to backend/dist/mail/mail.service.js)
    // __dirname in compiled code: backend/dist/mail
    // Go up 3 levels: backend/dist/mail -> backend/dist -> backend -> CrazyMail
    // Then: scripts/sendsmtp/sendsmtp (or sendsmtp.exe on Windows)
    const basePath = join(__dirname, '..', '..', '..', 'scripts', 'sendsmtp', 'sendsmtp');
    // Add .exe extension on Windows if not already present
    this.sendsmtpPath = platform() === 'win32' && !basePath.endsWith('.exe') 
      ? `${basePath}.exe` 
      : basePath;
    this.logger.log(`SMTP executable path: ${this.sendsmtpPath}`);
  }

  async getEmailsForUser(recipientEmail: string) {
    // Ensure recipientEmail is a full email address (username@domain), not just username
    if (!recipientEmail.includes('@')) {
      this.logger.warn(`getEmailsForUser called with non-email recipient: ${recipientEmail}`);
      return {
        emails: [],
        count: 0,
      };
    }

    this.logger.log(`Getting emails for user: ${recipientEmail}`);
    const emails = await this.mailRepository.find({
      where: { recipient: recipientEmail },
      order: { createdAt: 'DESC' },
    });

    // Decrypt emails for the user
    const user = await this.authService.getUserByEmail(recipientEmail);
    if (!user) {
      this.logger.warn(`User not found for email: ${recipientEmail}`);
      return {
        emails: [],
        count: 0,
      };
    }

    const decryptedEmails = await Promise.all(
      emails.map(async (email) => {
        try {
          const privateKey = await this.authService.getDecryptedPrivateKey(user);
          if (!privateKey) {
            this.logger.warn(`Could not decrypt private key for user: ${recipientEmail}`);
            return email; // Return encrypted email if decryption fails
          }

          const decryptedMessage = await this.pgpService.decryptMessage(
            email.message,
            privateKey,
          );

          return {
            ...email,
            message: decryptedMessage,
          };
        } catch (error) {
          this.logger.error(`Failed to decrypt email ${email.uid}:`, error);
          return email; // Return encrypted email if decryption fails
        }
      }),
    );

    this.logger.log(`Found ${decryptedEmails.length} emails for recipient: ${recipientEmail}`);
    return {
      emails: decryptedEmails,
      count: decryptedEmails.length,
    };
  }

  async getSentEmailsForUser(senderEmail: string) {
    const emails = await this.mailRepository.find({
      where: { sender: senderEmail },
      order: { createdAt: 'DESC' },
    });

    // Decrypt sent emails (sender uses their own private key)
    const user = await this.authService.getUserByEmail(senderEmail);
    if (!user) {
      this.logger.warn(`User not found for email: ${senderEmail}`);
      return {
        emails: [],
        count: 0,
      };
    }

    const decryptedEmails = await Promise.all(
      emails.map(async (email) => {
        try {
          // For sent emails, we need to decrypt with sender's private key
          // But the message was encrypted with recipient's public key
          // So we can't decrypt it here - we'd need recipient's private key
          // For now, return the encrypted message
          // In a real implementation, you might want to store a copy encrypted with sender's key
          return email;
        } catch (error) {
          this.logger.error(`Failed to process sent email ${email.uid}:`, error);
          return email;
        }
      }),
    );

    return {
      emails: decryptedEmails,
      count: decryptedEmails.length,
    };
  }

  async searchEmailsForUser(userEmail: string, query: string) {
    const inboxEmails = await this.mailRepository.find({
      where: { recipient: userEmail },
      order: { createdAt: 'DESC' },
    });

    const sentEmails = await this.mailRepository.find({
      where: { sender: userEmail },
      order: { createdAt: 'DESC' },
    });

    const allEmails = [...inboxEmails, ...sentEmails];

    // Filter emails by query (search in subject, message, sender, recipient)
    const queryLower = query.toLowerCase();
    const filteredEmails = allEmails.filter((email) => {
      // Get subject case-insensitively
      const subject = email.headers?.Subject || 
                      email.headers?.subject || 
                      email.headers?.SUBJECT || '';
      const message = email.message || '';
      const sender = email.sender || '';
      const recipient = email.recipient || '';

      return (
        subject.toLowerCase().includes(queryLower) ||
        message.toLowerCase().includes(queryLower) ||
        sender.toLowerCase().includes(queryLower) ||
        recipient.toLowerCase().includes(queryLower)
      );
    });

    return {
      emails: filteredEmails,
      count: filteredEmails.length,
    };
  }

  async getEmailById(uid: string, recipientEmail: string) {
    // Ensure recipientEmail is a full email address (username@domain), not just username
    if (!recipientEmail.includes('@')) {
      this.logger.warn(`getEmailById called with non-email recipient: ${recipientEmail}`);
      throw new NotFoundException('Invalid recipient email format');
    }

    this.logger.log(`Getting email by ID: ${uid} for recipient: ${recipientEmail}`);
    const email = await this.mailRepository.findOne({
      where: { uid, recipient: recipientEmail },
    });

    if (!email) {
      throw new NotFoundException('Email not found');
    }

    // Decrypt the email message
    const user = await this.authService.getUserByEmail(recipientEmail);
    if (!user) {
      this.logger.warn(`User not found for email: ${recipientEmail}`);
      return email; // Return encrypted email if user not found
    }

    try {
      const privateKey = await this.authService.getDecryptedPrivateKey(user);
      if (!privateKey) {
        this.logger.warn(`Could not decrypt private key for user: ${recipientEmail}`);
        return email; // Return encrypted email if decryption fails
      }

      const decryptedMessage = await this.pgpService.decryptMessage(
        email.message,
        privateKey,
      );

      return {
        ...email,
        message: decryptedMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to decrypt email ${uid}:`, error);
      return email; // Return encrypted email if decryption fails
    }
  }

  async sendEmail(sendMailDto: SendMailDto & { sender: string }) {
    const { recipient, sender, subject, message, headers, cc, bcc } = sendMailDto;

    // Get recipient's PGP public key
    const recipientPublicKey = await this.authService.getPublicKeyByEmail(recipient);
    if (!recipientPublicKey) {
      throw new BadRequestException(`Recipient ${recipient} does not have a PGP public key`);
    }

    // Encrypt message with recipient's public key
    let encryptedMessage: string;
    try {
      encryptedMessage = await this.pgpService.encryptMessage(message, recipientPublicKey);
    } catch (error) {
      this.logger.error(`Failed to encrypt message for ${recipient}:`, error);
      throw new InternalServerErrorException('Failed to encrypt email message');
    }

    // Generate UUID for the email
    const uid = uuidv4();

    // Prepare email headers for database
    const emailHeaders = {
      Subject: subject,
      From: sender,
      To: recipient,
      Date: new Date().toISOString(),
      ...headers,
    };

    // Create mail record in database with encrypted message
    const mail = this.mailRepository.create({
      uid,
      recipient,
      sender,
      headers: emailHeaders,
      message: encryptedMessage,
    });

    await this.mailRepository.save(mail);

    // Prepare JSON data for sendsmtp.exe
    const smtpData = {
      from: sender,
      to: [recipient],
      cc: cc || [],
      bcc: bcc || [],
      subject: subject,
      headers: headers || {},
      body: message,
    };

    // Send email using sendsmtp.exe (now uses direct MySMTP API instead of relay server)
    try {
      this.logger.log(`Sending email via sendsmtp (direct MySMTP API): ${this.sendsmtpPath}`);
      this.logger.debug(`SMTP data: ${JSON.stringify(smtpData, null, 2)}`);

      // Use -json flag to pass JSON data to sendsmtp
      // sendsmtp will resolve MX records and send directly to recipient mail servers
      // Increased timeout to allow for MX resolution, connection, and full SMTP conversation
      const { stdout, stderr } = await execFileAsync(
        this.sendsmtpPath,
        ['-json', JSON.stringify(smtpData)],
        {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 60000, // 60 second timeout for MX resolution, connection, and full SMTP conversation
        },
      );

      if (stderr) {
        this.logger.warn(`sendsmtp stderr: ${stderr}`);
      }

      this.logger.log(`sendsmtp stdout: ${stdout}`);
      this.logger.log('Email sent successfully via direct MySMTP API');

      return {
        message: 'Email sent successfully',
        uid,
        mail: {
          uid: mail.uid,
          recipient: mail.recipient,
          sender: mail.sender,
          subject: emailHeaders.Subject,
          createdAt: mail.createdAt,
        },
      };
    } catch (error: any) {
      this.logger.error(`Failed to send email via sendsmtp: ${error.message}`);
      this.logger.error(error.stack);

      // Email is still saved in database, but sending failed
      throw new InternalServerErrorException(
        `Failed to send email: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Receive email from postsmtp SMTP server
   * Parses raw email data and stores it in the database
   */
  async receiveEmail(receiveEmailDto: ReceiveEmailDto) {
    const { mailFrom, rcptTo, data } = receiveEmailDto;

    // Decode base64 data if needed
    let emailData: string;
    try {
      // Try to decode as base64 first
      const decoded = Buffer.from(data, 'base64').toString('utf-8');
      // If decoding produces valid email-like content, use it
      if (decoded.includes('\n') || decoded.includes('From:') || decoded.includes('To:')) {
        emailData = decoded;
      } else {
        // If not valid, use as-is (might already be plain text)
        emailData = data;
      }
    } catch {
      // If base64 decoding fails, use as-is
      emailData = data;
    }

    // Parse email to extract headers and body
    emailData = emailData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = emailData.split('\n');

    const headers: Record<string, string> = {};
    let body = '';
    let inBody = false;
    let currentHeader = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!inBody) {
        if (trimmedLine === '') {
          inBody = true;
          continue;
        }

        if (line.startsWith(' ') || line.startsWith('\t')) {
          // Continuation of previous header
          if (currentHeader) {
            headers[currentHeader] = (headers[currentHeader] || '') + ' ' + trimmedLine;
          }
        } else if (line.includes(':')) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            currentHeader = line.substring(0, colonIndex).trim().toLowerCase();
            const headerValue = line.substring(colonIndex + 1).trim();

            if (headers[currentHeader]) {
              headers[currentHeader] = headers[currentHeader] + ', ' + headerValue;
            } else {
              headers[currentHeader] = headerValue;
            }
          }
        }
      } else {
        body += line + '\n';
      }
    }

    // Remove trailing newline from body
    body = body.trimEnd();

    // Validate recipients exist in the system before storing
    // This prevents fraudulent emails from being stored
    for (const recipient of rcptTo) {
      if (!recipient.includes('@')) {
        throw new BadRequestException(`Invalid recipient format: ${recipient}`);
      }

      // Extract username from email (e.g., "user@domain.com" -> "user")
      const username = recipient.split('@')[0];
      
      // Verify user exists in the system - this prevents storing emails for non-existent users
      const userExists = await this.authService.userExistsByUsername(username);
      if (!userExists) {
        throw new BadRequestException(`Recipient user does not exist: ${username}`);
      }
    }

    // Store email for each recipient
    const storedEmails = [];

    for (const recipient of rcptTo) {
      // Get recipient's PGP public key
      const recipientPublicKey = await this.authService.getPublicKeyByEmail(recipient);
      if (!recipientPublicKey) {
        this.logger.warn(`Recipient ${recipient} does not have a PGP public key, storing unencrypted`);
        // Store unencrypted if recipient doesn't have PGP key
        // This handles edge cases during migration
      }

      let encryptedBody = body;
      if (recipientPublicKey) {
        try {
          encryptedBody = await this.pgpService.encryptMessage(body, recipientPublicKey);
        } catch (error) {
          this.logger.error(`Failed to encrypt message for ${recipient}:`, error);
          // Store unencrypted if encryption fails
          encryptedBody = body;
        }
      }

      const uid = uuidv4();
      const mail = this.mailRepository.create({
        uid,
        recipient,
        sender: mailFrom,
        headers,
        message: encryptedBody,
      });

      await this.mailRepository.save(mail);
      storedEmails.push({
        uid,
        recipient,
      });

      this.logger.log(`Stored email from ${mailFrom} to ${recipient} (UID: ${uid})`);
    }

    if (storedEmails.length === 0) {
      throw new BadRequestException('No valid recipients provided');
    }

    return {
      message: 'Email received and stored successfully',
      storedEmails,
    };
  }
}

