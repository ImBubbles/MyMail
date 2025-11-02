import { IsString, IsNotEmpty, IsEmail, IsObject, IsOptional, IsArray } from 'class-validator';

export class SendMailDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  sender?: string;

  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsArray()
  @IsOptional()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsObject()
  @IsOptional()
  headers?: Record<string, string>;
}

