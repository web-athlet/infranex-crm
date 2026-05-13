import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeType(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateNoteDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => normalizeType(value))
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{0,49}$/)
  type?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/)
  organizationId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/)
  personId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/)
  dealId?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @Matches(/^c[a-z0-9]{24}$/)
  activityId?: string | null;
}
