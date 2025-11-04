import { IsString, IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveEmailDto {
  @IsString()
  @IsNotEmpty()
  mailFrom: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  rcptTo: string[];

  @IsString()
  @IsNotEmpty()
  data: string; // Base64 encoded email data
}

