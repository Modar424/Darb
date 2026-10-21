import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assessment, AssessmentAttempt, CourseModule, Question } from '../../database/entities';
import { CoursesModule } from '../courses/courses.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { AttemptsService } from './attempts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Assessment, Question, AssessmentAttempt, CourseModule]),
    CoursesModule,
  ],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, AttemptsService],
})
export class AssessmentsModule {}
