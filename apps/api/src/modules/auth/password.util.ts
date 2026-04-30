import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_BCRYPT_PASSWORD_BYTES = 72;

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
