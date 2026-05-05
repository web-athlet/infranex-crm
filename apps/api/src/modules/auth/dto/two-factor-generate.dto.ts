import { IsOptional, IsString, MinLength } from 'class-validator';

export class TwoFactorGenerateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  setupToken?: string;
}
