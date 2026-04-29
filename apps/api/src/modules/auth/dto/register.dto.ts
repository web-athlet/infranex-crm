import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { MaxBcryptPasswordBytes } from '../password.util';

function normalizeEmail(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }: { value: unknown }) => normalizeEmail(value))
  @IsEmail()
  email!: string;

  @IsString()
  @MaxBcryptPasswordBytes()
  @Matches(PASSWORD_POLICY, {
    message:
      'password must be at least 8 characters and include an uppercase letter, a digit, and a special character',
  })
  password!: string;
}
