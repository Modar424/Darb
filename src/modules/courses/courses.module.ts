import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Course,
  CourseModule as CourseModuleEntity,
  Enrollment,
  Lesson,
  ProgressRecord,
  User,
} from '../../database/entities';
import { CourseAccessService } from './course-access.service';
import { CoursesController, StructureController } from './courses.controller';
import { CoursesService } from './courses.service';
import { StructureService } from './structure.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      CourseModuleEntity,
      Lesson,
      Enrollment,
      ProgressRecord,
      User,
    ]),
  ],
  controllers: [CoursesController, StructureController],
  providers: [CourseAccessService, CoursesService, StructureService],
  exports: [CourseAccessService, CoursesService],
})
export class CoursesModule {}
