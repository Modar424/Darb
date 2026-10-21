import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AssessmentAttempt,
  AssignmentSubmission,
  AuditLog,
  Course,
  Enrollment,
  Role,
  Session,
  User,
} from '../../database/entities';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Role,
      Course,
      Enrollment,
      AssessmentAttempt,
      AssignmentSubmission,
      AuditLog,
      Session,
    ]),
    AuthModule,
    CoursesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
