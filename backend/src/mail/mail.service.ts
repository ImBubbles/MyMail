import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { Mail } from '../entities/mail.entity';
import { SendMailDto } from './dto/send-mail.dto';

const execFileAsync = promisify(execFile);

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly sendsmtpPath: string;

  constructor(
    @InjectRepository(Mail)
    private mailRepository: Repository<Mail>,
  ) {
    // Resolve path to sendsmtp.exe
    // From backend/src/mail/mail.service.ts (compiled to backend/dist/mail/mail.service.js)
    // __dirname in compiled code: backend/dist/mail
    // Go up 3 levels: backend/dist/mail -> backend/dist -> backend -> CrazyMail
    // Then: scripts/sendsmtp/sendsmtp.exe
    this.sendsmtpPath = join(__dirname, '..', '..', '..', 'scripts', 'sendsmtp', 'sendsmtp');
    this.logger.log(`SMTP executable path: ${this.sendsmtpPath}`);
  }

  async getEmailsForUser(recipientEmail: string) {
    const emails = await this.mailRepository.find({
      where: { recipient: recipientEmail },
      order: { createdAt: 'DESC' },
    });

    return {
      emails,
      count: emails.length,
    };
  }

  async getSentEmailsForUser(senderEmail: string) {
    const emails = await this.mailRepository.find({
      where: { sender: senderEmail },
      order: { createdAt: 'DESC' },
    });

    return {
      emails,
      count: emails.length,
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
      const subject = email.headers?.Subject || '';
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
    const email = await this.mailRepository.findOne({
      where: { uid, recipient: recipientEmail },
    });

    if (!email) {
      throw new NotFoundException('Email not found');
    }

    return email;
  }

  async sendEmail(sendMailDto: SendMailDto & { sender: string }) {
    const { recipient, sender, subject, message, headers, cc, bcc } = sendMailDto;

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

    // Create mail record in database
    const mail = this.mailRepository.create({
      uid,
      recipient,
      sender,
      headers: emailHeaders,
      message,
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

    // Send email using sendsmtp.exe
    try {
      this.logger.log(`Sending email via sendsmtp.exe: ${this.sendsmtpPath}`);
      this.logger.debug(`SMTP data: ${JSON.stringify(smtpData, null, 2)}`);

      const { stdout, stderr } = await execFileAsync(this.sendsmtpPath, [JSON.stringify(smtpData)], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (stderr) {
        this.logger.warn(`sendsmtp.exe stderr: ${stderr}`);
      }

      this.logger.log(`sendsmtp.exe stdout: ${stdout}`);
      this.logger.log('Email sent successfully via SMTP');

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
      this.logger.error(`Failed to send email via sendsmtp.exe: ${error.message}`);
      this.logger.error(error.stack);

      // Email is still saved in database, but sending failed
      throw new InternalServerErrorException(
        `Failed to send email: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

