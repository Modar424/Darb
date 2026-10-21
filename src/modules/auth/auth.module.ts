import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken, Role, Session, User } from '../../database/entities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Session, PasswordResetToken])],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService],
  exports: [SessionService, PasswordService],
})
export class AuthModule {}
