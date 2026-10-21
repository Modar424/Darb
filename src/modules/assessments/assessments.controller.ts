import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, Roles, UuidParam } from '../../common/decorators';
import { PageQueryDto } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { AssessmentsService } from './assessments.service';
import { AttemptsService } from './attempts.service';
import {
  CreateAssessmentDto,
  CreateQuestionDto,
  SubmitAttemptDto,
  UpdateAssessmentDto,
  UpdateQuestionDto,
} from './dto';

const STAFF = [RoleName.INSTRUCTOR, RoleName.ADMIN];

@ApiTags('Assessments')
@ApiCookieAuth()
@Controller()
export class AssessmentsController {
  constructor(
    private readonly assessments: AssessmentsService,
    private readonly attempts: AttemptsService,
  ) {}

  @Roles(...STAFF)
  @Post('courses/:courseId/assessments')
  create(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Body() dto: CreateAssessmentDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assessments.create(user, courseId, dto, meta);
  }

  @Get('courses/:courseId/assessments')
  list(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Query() q: PageQueryDto,
  ) {
    return this.assessments.listForCourse(user, courseId, q);
  }

  @Get('assessments/:id')
  @ApiOperation({ summary: 'Staff: full definition incl. answer key. Learners: metadata only.' })
  get(@CurrentUser() user: AuthUser, @UuidParam() id: string) {
    return this.assessments.get(user, id);
  }

  @Roles(...STAFF)
  @Patch('assessments/:id')
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateAssessmentDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assessments.update(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @HttpCode(200)
  @Post('assessments/:id/publish')
  publish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assessments.publish(user, id, meta);
  }

  @Roles(...STAFF)
  @HttpCode(200)
  @Post('assessments/:id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assessments.unpublish(user, id, meta);
  }

  @Roles(...STAFF)
  @Delete('assessments/:id')
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.assessments.remove(user, id, meta);
  }

  @Roles(...STAFF)
  @Post('assessments/:id/questions')
  addQuestion(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: CreateQuestionDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assessments.addQuestion(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @Patch('questions/:id')
  updateQuestion(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateQuestionDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.assessments.updateQuestion(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @Delete('questions/:id')
  removeQuestion(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Meta() meta: RequestMeta,
  ) {
    return this.assessments.removeQuestion(user, id, meta);
  }

  @Roles(RoleName.STUDENT)
  @Post('assessments/:id/attempts')
  @ApiOperation({
    summary: 'Start (or resume) an attempt; questions are returned without the answer key',
  })
  start(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.attempts.start(user, id, meta);
  }

  @Get('assessments/:id/attempts')
  listAttempts(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Query() q: PageQueryDto) {
    return this.attempts.list(user, id, q);
  }

  @Get('attempts/:id')
  getAttempt(@CurrentUser() user: AuthUser, @UuidParam() id: string) {
    return this.attempts.get(user, id);
  }

  @Roles(RoleName.STUDENT)
  @HttpCode(200)
  @Post('attempts/:id/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: SubmitAttemptDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.attempts.submit(user, id, dto, meta);
  }
}
