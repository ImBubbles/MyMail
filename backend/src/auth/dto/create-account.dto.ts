import { IsString, IsNotEmpty, MinLength, IsEmail, IsOptional } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

