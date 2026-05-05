import { IsOptional, IsString, MinLength } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  setupToken?: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
