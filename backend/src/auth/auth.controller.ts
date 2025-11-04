import {
  Controller,
  Post,
  Body,
  Get,
  Headers,
  Param,
  UseGuards,
} from '@nestjs/common';
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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('validate')
  async validateToken(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '') || authorization;
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

