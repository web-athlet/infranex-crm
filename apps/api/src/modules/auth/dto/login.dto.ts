import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
