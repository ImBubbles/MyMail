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
import { EncryptionService } from '../utils/encryption.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  async createAccount(createAccountDto: CreateAccountDto) {
    const { username, password, email } = createAccountDto;

    // Get HOSTNAME from .env and append to username to create email
    const hostname = this.configService.get<string>('HOSTNAME', 'localhost');
    const userEmail = email || `${username}@${hostname}`;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ username }],
    });

    // Check username conflict
    if (existingUser) {
      throw new ConflictException(
        'User with this username already exists',
      );
    }

    // Check email conflict by decrypting all emails
    const usersWithEmails = await this.userRepository.find({
      where: {},
    });
    const emailConflict = usersWithEmails.some((user) => {
      if (!user.email || !user.encryptionKey) return false;
      try {
        const decryptedEmail = this.decryptUserEmail(user);
        return decryptedEmail === userEmail;
      } catch {
        // If decryption fails, skip this user
        return false;
      }
    });

    if (emailConflict) {
      throw new ConflictException(
        'User with this email already exists',
      );
    }

    // Generate user-specific encryption key
    const userKey = this.encryptionService.generateUserKey();
    const encryptedUserKey = this.encryptionService.encryptUserKey(userKey);

    // Encrypt email with user's key
    const encryptedEmail = this.encryptionService.encryptWithUserKey(
      userEmail,
      userKey,
    );

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with encrypted email and encrypted user key
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      salt,
      email: encryptedEmail,
      encryptionKey: encryptedUserKey,
    });

    await this.userRepository.save(user);

    // Generate JWT token
    const token = await this.generateToken(user);

    return {
      message: 'Account created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: userEmail,
      },
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Find user by username first
    let user = await this.userRepository.findOne({
      where: [{ username }],
    });

    // If not found by username, try to find by email (decrypting all emails)
    if (!user) {
      const allUsers = await this.userRepository.find();
      user = allUsers.find((u) => {
        if (!u.email || !u.encryptionKey) return false;
        try {
          const decryptedEmail = this.decryptUserEmail(u);
          return decryptedEmail === username;
        } catch {
          return false;
        }
      }) || null;
    }

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

    // Decrypt email before returning
    const decryptedEmail = this.decryptUserEmail(user);

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: decryptedEmail,
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

      // Decrypt email before returning
      const decryptedEmail = this.decryptUserEmail(user);

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          email: decryptedEmail,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getUserById(userId: number): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    
    // Decrypt email if user exists
    if (user && user.email) {
      user.email = this.decryptUserEmail(user);
    }
    
    return user;
  }

  /**
   * Check if a user exists by username
   * Used for validating recipients in received emails
   */
  async userExistsByUsername(username: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { username },
    });
    return user !== null;
  }

  /**
   * Decrypts a user's email using their per-user encryption key
   */
  private decryptUserEmail(user: User): string | null {
    if (!user.email || !user.encryptionKey) {
      return null;
    }

    try {
      // Decrypt the user's encryption key with master key
      const userKey = this.encryptionService.decryptUserKey(
        user.encryptionKey,
      );
      // Decrypt the email with the user's key
      return this.encryptionService.decryptWithUserKey(user.email, userKey);
    } catch (error) {
      console.error(`Failed to decrypt email for user ${user.id}:`, error);
      return null;
    }
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

