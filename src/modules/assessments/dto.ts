import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType, ReviewPolicy } from '../../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAssessmentDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  timeLimitMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passingPercent?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  availableFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  @IsOptional()
  @IsEnum(ReviewPolicy)
  reviewPolicy?: ReviewPolicy;
}

export class UpdateAssessmentDto extends PartialType(CreateAssessmentDto) {}

export class OptionDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  id!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}

export class CreateQuestionDto {
  @IsEnum(QuestionType)
  type!: QuestionType;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options!: OptionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  correctOptionIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  points?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class SubmitAttemptDto {
  /** Map of questionId -> selected option ids. */
  @IsObject()
  answers!: Record<string, string[]>;
}
