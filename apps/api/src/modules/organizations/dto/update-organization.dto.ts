import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateOrganizationDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
