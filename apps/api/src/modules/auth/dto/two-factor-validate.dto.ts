import { IsString, MinLength } from 'class-validator';

export class TwoFactorValidateDto {
  @IsString()
  @MinLength(1)
  challengeToken!: string;

  @IsString()
  @MinLength(1)
  code!: string;
}
