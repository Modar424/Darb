import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/dto/pagination';
import { CourseLevel, LessonContentType } from '../../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCourseDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  description!: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;

  /** Admin only: create the course on behalf of an instructor. */
  @IsOptional()
  @IsUUID()
  instructorId?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  description?: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;
}

export class ListCoursesQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;

  @IsOptional()
  @IsUUID()
  instructorId?: string;
}

export class CreateModuleDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateModuleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class CreateLessonDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsEnum(LessonContentType)
  contentType?: LessonContentType;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  contentUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
