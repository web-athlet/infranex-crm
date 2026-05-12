import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ActivityType, Priority } from '@prisma/client';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateActivityDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsISO8601({ strict: true })
  dueAt?: string | null;

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
}
