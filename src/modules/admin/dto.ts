import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsAcceptablePassword } from '../../common/dto/validators';
import { PageQueryDto } from '../../common/dto/pagination';
import { CourseStatus, RoleName, UserStatus } from '../../database/entities';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class AdminCreateUserDto {
  @Transform(lower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsAcceptablePassword()
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(RoleName, { each: true })
  roles!: RoleName[];
}

export class AdminUpdateUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(RoleName, { each: true })
  roles?: RoleName[];
}

export class ListUsersQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class AdminListCoursesQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}

export class ListAuditQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  action?: string;
  @IsOptional()
  @IsUUID()
  actorId?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  entityType?: string;
}
