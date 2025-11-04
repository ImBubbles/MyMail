import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Get API key from header
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    // Get expected API key from environment
    const expectedApiKey = this.configService.get<string>('POSTSMTP_API_KEY');
    
    if (!expectedApiKey) {
      throw new UnauthorizedException('API key not configured on server');
    }

    // Compare API keys (use constant-time comparison to prevent timing attacks)
    if (!this.constantTimeCompare(apiKey, expectedApiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

