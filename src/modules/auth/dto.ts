import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsAcceptablePassword } from '../../common/dto/validators';

const normaliseEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(normaliseEmail)
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

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: string;
}

export class LoginDto {
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class ForgotPasswordDto {
  @Transform(normaliseEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MaxLength(128)
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MaxLength(128)
  newPassword!: string;
}
