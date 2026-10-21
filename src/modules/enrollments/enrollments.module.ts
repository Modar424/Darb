import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course, Enrollment } from '../../database/entities';
import { CoursesModule } from '../courses/courses.module';
import { ProgressModule } from '../progress/progress.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment, Course]), CoursesModule, ProgressModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
