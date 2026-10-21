import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
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
import { SubmissionStatus } from '../../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAssignmentDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  instructions!: string;

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPoints?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueAt?: Date;

  @IsOptional()
  @IsBoolean()
  allowLate?: boolean;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}

export class SubmitAssignmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  content!: string;

  @IsOptional()
  @Transform(trim)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  linkUrl?: string;
}

export class GradeSubmissionDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  grade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}

export class ListSubmissionsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;
}
