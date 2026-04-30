import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_BCRYPT_PASSWORD_BYTES = 72;
export const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  'password must be at least 8 characters and include an uppercase letter, a digit, and a special character';

export function isBcryptPasswordInputLengthValid(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= MAX_BCRYPT_PASSWORD_BYTES;
}

export function MaxBcryptPasswordBytes(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'maxBcryptPasswordBytes',
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isBcryptPasswordInputLengthValid(value);
        },
        defaultMessage(): string {
          return `password must be at most ${MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes`;
        },
      },
    },
    validationOptions,
  );
}
