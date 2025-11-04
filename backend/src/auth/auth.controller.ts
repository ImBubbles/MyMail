import {
  Controller,
  Post,
  Body,
  Get,
  Headers,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { LoginDto } from './dto/login.dto';
import { ApiKeyGuard } from './guards/api-key.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async createAccount(@Body() createAccountDto: CreateAccountDto) {
    return this.authService.createAccount(createAccountDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    
    // Set HTTP-only cookie with appropriate expiration
    const rememberMe = loginDto.rememberMe === true;
    const maxAge = rememberMe 
      ? 60 * 60 * 24 * 30 // 30 days
      : 60 * 60 * 24; // 1 day
    
    // Determine if we should use secure cookies (HTTPS)
    // Check if frontend URL uses HTTPS or if explicitly enabled
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const useSecureCookies = frontendUrl.startsWith('https://') || process.env.ENABLE_HTTPS === 'true';
    
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: useSecureCookies, // HTTPS only when frontend uses HTTPS
      sameSite: 'lax',
      maxAge: maxAge * 1000, // Convert to milliseconds
      path: '/',
    });
    
    return result;
  }

  @Get('validate')
  async validateToken(
    @Headers('authorization') authorization: string,
    @Headers('cookie') cookie: string,
  ) {
    // Try to get token from Authorization header first
    let token = authorization?.replace('Bearer ', '') || authorization;
    
    // If no token in header, try to get from cookie
    if (!token && cookie) {
      const authTokenMatch = cookie.match(/auth_token=([^;]+)/);
      if (authTokenMatch) {
        token = authTokenMatch[1];
      }
    }
    
    if (!token) {
      return { valid: false, user: null };
    }
    
    return this.authService.validateToken(token);
  }

  @Post('token')
  async refreshToken(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '') || authorization;
    const validation = await this.authService.validateToken(token);
    
    // Return validated token info
    return {
      message: 'Token is valid',
      user: validation.user,
    };
  }

  @Get('validate-user/:username')
  @UseGuards(ApiKeyGuard)
  async validateUser(@Param('username') username: string) {
    const exists = await this.authService.userExistsByUsername(username);
    return {
      exists,
      username,
    };
  }
}

