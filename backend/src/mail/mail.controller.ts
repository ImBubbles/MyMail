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
} from '@nestjs/common';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly authService: AuthService,
  ) {}

  private async getUserEmail(req: any): Promise<string> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    const user = await this.authService.getUserById(userId);
    const userEmail = user?.email;

    if (!userEmail) {
      throw new UnauthorizedException('User email not found');
    }

    return userEmail;
  }

  @Get('inbox')
  async getInbox(@Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getEmailsForUser(userEmail);
  }

  @Get('sent')
  async getSent(@Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getSentEmailsForUser(userEmail);
  }

  @Get('search')
  async searchEmails(@Query('q') query: string, @Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    if (!query || query.trim() === '') {
      return { emails: [], count: 0 };
    }
    return this.mailService.searchEmailsForUser(userEmail, query);
  }

  @Get(':uid')
  async getEmailById(@Param('uid') uid: string, @Request() req: any) {
    const userEmail = await this.getUserEmail(req);
    return this.mailService.getEmailById(uid, userEmail);
  }

  @Post('send')
  async sendEmail(@Body() sendMailDto: SendMailDto, @Request() req: any) {
    // Get user from token payload
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }

    // Fetch user to get email
    const user = await this.authService.getUserById(userId);
    const senderEmail = user?.email;

    if (!senderEmail) {
      throw new UnauthorizedException('User email not found');
    }

    return this.mailService.sendEmail({
      ...sendMailDto,
      sender: senderEmail,
    });
  }
}

