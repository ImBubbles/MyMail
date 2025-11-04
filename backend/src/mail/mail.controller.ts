import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { ReceiveEmailDto } from './dto/receive-email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';

@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private async getUserEmail(req: any): Promise<string> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Ensure we always use the full email (username@domain), not just username
    // If user.email exists and is a full email (contains @), use it
    // Otherwise, construct it from username@hostname
    let userEmail = user.email;
    
    if (!userEmail || !userEmail.includes('@')) {
      // Construct full email from username@hostname
      const hostname = this.configService.get<string>('HOSTNAME', 'localhost');
      userEmail = `${user.username}@${hostname}`;
    }

    return userEmail;
  }

  @Get('inbox')
  @UseGuards(JwtAuthGuard)
  async getInbox(@Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getEmailsForUser(userEmail);
  }

  @Get('sent')
  @UseGuards(JwtAuthGuard)
  async getSent(@Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getSentEmailsForUser(userEmail);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchEmails(@Query('q') query: string, @Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    if (!query || query.trim() === '') {
      return { emails: [], count: 0 };
    }
    return this.mailService.searchEmailsForUser(userEmail, query);
  }

  @Get(':uid')
  @UseGuards(JwtAuthGuard)
  async getEmailById(@Param('uid') uid: string, @Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getEmailById(uid, userEmail);
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendEmail(@Body() sendMailDto: SendMailDto, @Request() req: any) {
    // Get user email (always full email: username@domain)
    const senderEmail = await this.getUserEmail(req);

    return this.mailService.sendEmail({
      ...sendMailDto,
      sender: senderEmail,
    });
  }

  /**
   * Receive email from postsmtp SMTP server
   * This endpoint is secured with API key authentication
   * Only postsmtp can call this endpoint to store received emails
   */
  @Post('receive')
  @UseGuards(ApiKeyGuard)
  async receiveEmail(@Body() receiveEmailDto: ReceiveEmailDto) {
    return this.mailService.receiveEmail(receiveEmailDto);
  }
}

