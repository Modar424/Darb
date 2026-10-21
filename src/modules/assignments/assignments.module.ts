import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Assignment, AssignmentSubmission, CourseModule } from '../../database/entities';
import { CoursesModule } from '../courses/courses.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Assignment, AssignmentSubmission, CourseModule]),
    CoursesModule,
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
})
export class AssignmentsModule {}
