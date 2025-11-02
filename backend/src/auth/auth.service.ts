import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async createAccount(createAccountDto: CreateAccountDto) {
    const { username, password, email } = createAccountDto;

    // Get HOSTNAME from .env and append to username to create email
    const hostname = this.configService.get<string>('HOSTNAME', 'localhost');
    const userEmail = email || `${username}@${hostname}`;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ username }, { email: userEmail }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this username or email already exists',
      );
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with email from HOSTNAME
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      salt,
      email: userEmail,
    });

    await this.userRepository.save(user);

    // Generate JWT token
    const token = await this.generateToken(user);

    return {
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Find user by username or email
    const user = await this.userRepository.findOne({
      where: [{ username }, { email: username }],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = await this.generateToken(user);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    };
  }

  async validateToken(token: string) {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  private async generateToken(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
    };

    const secret = this.configService.get<string>('JWT_SECRET', 'default-secret');
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');

    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });
  }
}

