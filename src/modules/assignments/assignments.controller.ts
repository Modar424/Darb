import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, Roles, UuidParam } from '../../common/decorators';
import { PageQueryDto } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { AssignmentsService } from './assignments.service';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  ListSubmissionsQueryDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from './dto';

const STAFF = [RoleName.INSTRUCTOR, RoleName.ADMIN];

@ApiTags('Assignments')
@ApiCookieAuth()
@Controller()
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles(...STAFF)
  @Post('courses/:courseId/assignments')
  create(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Body() dto: CreateAssignmentDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assignments.create(user, courseId, dto, meta);
  }

  @Get('courses/:courseId/assignments')
  list(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Query() q: PageQueryDto,
  ) {
    return this.assignments.listForCourse(user, courseId, q);
  }

  @Get('assignments/:id')
  get(@CurrentUser() user: AuthUser, @UuidParam() id: string) {
    return this.assignments.get(user, id);
  }

  @Roles(...STAFF)
  @Patch('assignments/:id')
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateAssignmentDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assignments.update(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @HttpCode(200)
  @Post('assignments/:id/publish')
  publish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assignments.setPublished(user, id, true, meta);
  }

  @Roles(...STAFF)
  @HttpCode(200)
  @Post('assignments/:id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assignments.setPublished(user, id, false, meta);
  }

  @Roles(...STAFF)
  @Delete('assignments/:id')
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assignments.remove(user, id, meta);
  }

  @Roles(RoleName.STUDENT)
  @Put('assignments/:id/submission')
  submit(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: SubmitAssignmentDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assignments.submit(user, id, dto, meta);
  }

  @Get('assignments/:id/submissions')
  listSubmissions(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Query() q: ListSubmissionsQueryDto,
  ) {
    return this.assignments.listSubmissions(user, id, q);
  }

  @Get('submissions/:id')
  getSubmission(@CurrentUser() user: AuthUser, @UuidParam() id: string) {
    return this.assignments.getSubmission(user, id);
  }

  @Roles(...STAFF)
  @Put('submissions/:id/grade')
  grade(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: GradeSubmissionDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assignments.grade(user, id, dto, meta);
  }
}
