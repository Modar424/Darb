import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, Roles, UuidParam } from '../../common/decorators';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { ProgressService } from './progress.service';

@ApiTags('Progress')
@ApiCookieAuth()
@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Roles(RoleName.STUDENT)
  @HttpCode(200)
  @Post('lessons/:lessonId/complete')
  complete(
    @CurrentUser() user: AuthUser,
    @UuidParam('lessonId') lessonId: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.progress.completeLesson(user, lessonId, meta);
  }

  @Roles(RoleName.STUDENT)
  @Delete('lessons/:lessonId/complete')
  uncomplete(@CurrentUser() user: AuthUser, @UuidParam('lessonId') lessonId: string) {
    return this.progress.uncompleteLesson(user, lessonId);
  }

  @Roles(RoleName.STUDENT)
  @Get('progress/me/summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.progress.mySummary(user);
  }

  @Roles(RoleName.STUDENT)
  @Get('courses/:courseId/progress')
  mine(@CurrentUser() user: AuthUser, @UuidParam('courseId') courseId: string) {
    return this.progress.myCourseProgress(user, courseId);
  }

  @Roles(RoleName.INSTRUCTOR, RoleName.ADMIN)
  @Get('courses/:courseId/learners/:studentId/progress')
  learner(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @UuidParam('studentId') studentId: string,
  ) {
    return this.progress.learnerProgress(user, courseId, studentId);
  }
}
