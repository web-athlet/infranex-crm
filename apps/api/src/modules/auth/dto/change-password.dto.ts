import { IsString, Matches, MinLength } from 'class-validator';

import { MaxBcryptPasswordBytes, PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from '../password.util';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  @IsString()
  @MaxBcryptPasswordBytes()
  @Matches(PASSWORD_POLICY, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
