import { Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, Roles, UuidParam } from '../../common/decorators';
import { PageQueryDto } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('Enrollments')
@ApiCookieAuth()
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Roles(RoleName.STUDENT)
  @HttpCode(201)
  @Post('courses/:courseId/enroll')
  enroll(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.enrollments.enroll(user, courseId, meta);
  }

  @Roles(RoleName.STUDENT)
  @Delete('courses/:courseId/enroll')
  drop(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.enrollments.drop(user, courseId, meta);
  }

  @Roles(RoleName.STUDENT)
  @Get('enrollments/me')
  mine(@CurrentUser() user: AuthUser, @Query() q: PageQueryDto) {
    return this.enrollments.myEnrollments(user, q);
  }

  @Roles(RoleName.INSTRUCTOR, RoleName.ADMIN)
  @Get('courses/:courseId/learners')
  learners(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Query() q: PageQueryDto,
  ) {
    return this.enrollments.learners(user, courseId, q);
  }
}
