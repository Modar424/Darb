import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, OptionalUser, Public, Roles, UuidParam } from '../../common/decorators';
import { PageQueryDto } from '../../common/dto/pagination';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { CoursesService } from './courses.service';
import { StructureService } from './structure.service';
import {
  CreateCourseDto,
  CreateLessonDto,
  CreateModuleDto,
  ListCoursesQueryDto,
  ReorderDto,
  UpdateCourseDto,
  UpdateLessonDto,
  UpdateModuleDto,
} from './dto';

const STAFF = [RoleName.INSTRUCTOR, RoleName.ADMIN];

@ApiTags('Courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public catalogue of published courses (search, filter, paginate)' })
  list(@Query() q: ListCoursesQueryDto) {
    return this.courses.listPublished(q);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @Get('mine')
  @ApiOperation({ summary: 'Courses owned by the current instructor (all statuses)' })
  mine(@CurrentUser() user: AuthUser, @Query() q: PageQueryDto) {
    return this.courses.listMine(user, q);
  }

  @Public()
  @Get('by-slug/:slug')
  bySlug(@OptionalUser() user: AuthUser | null, @Param('slug') slug: string) {
    return this.courses.getDetailBySlug(user, slug.slice(0, 190));
  }

  @Public()
  @Get(':id')
  get(@OptionalUser() user: AuthUser | null, @UuidParam() id: string) {
    return this.courses.getDetail(user, id);
  }

  @Public()
  @Get(':id/curriculum')
  curriculum(@OptionalUser() user: AuthUser | null, @UuidParam() id: string) {
    return this.courses.curriculum(user, id);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto, @Meta() meta: RequestMeta) {
    return this.courses.create(user, dto, meta);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateCourseDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.courses.update(user, id, dto, meta);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @HttpCode(200)
  @Post(':id/publish')
  publish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.courses.publish(user, id, meta);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @HttpCode(200)
  @Post(':id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.courses.unpublish(user, id, meta);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @HttpCode(200)
  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.courses.archive(user, id, meta);
  }

  @ApiCookieAuth()
  @Roles(...STAFF)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.courses.remove(user, id, meta);
  }
}

@ApiTags('Course structure')
@ApiCookieAuth()
@Controller()
export class StructureController {
  constructor(private readonly structure: StructureService) {}

  @Roles(...STAFF)
  @Post('courses/:courseId/modules')
  createModule(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Body() dto: CreateModuleDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.createModule(user, courseId, dto, meta);
  }

  @Roles(...STAFF)
  @Put('courses/:courseId/modules/order')
  reorderModules(
    @CurrentUser() user: AuthUser,
    @UuidParam('courseId') courseId: string,
    @Body() dto: ReorderDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.reorderModules(user, courseId, dto.ids, meta);
  }

  @Roles(...STAFF)
  @Patch('modules/:id')
  updateModule(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateModuleDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.updateModule(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @Delete('modules/:id')
  removeModule(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.structure.removeModule(user, id, meta);
  }

  @Roles(...STAFF)
  @Post('modules/:id/lessons')
  createLesson(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: CreateLessonDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.createLesson(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @Put('modules/:id/lessons/order')
  reorderLessons(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: ReorderDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.reorderLessons(user, id, dto.ids, meta);
  }

  @Get('lessons/:id')
  @ApiOperation({
    summary: 'Lesson content: managers, enrolled learners, or preview lessons of published courses',
  })
  getLesson(@CurrentUser() user: AuthUser, @UuidParam() id: string) {
    return this.structure.getLesson(user, id);
  }

  @Roles(...STAFF)
  @Patch('lessons/:id')
  updateLesson(
    @CurrentUser() user: AuthUser,
    @UuidParam() id: string,
    @Body() dto: UpdateLessonDto,
    @Meta() meta: RequestMeta,
  ) {
    return this.structure.updateLesson(user, id, dto, meta);
  }

  @Roles(...STAFF)
  @Delete('lessons/:id')
  removeLesson(@CurrentUser() user: AuthUser, @UuidParam() id: string, @Meta() meta: RequestMeta) {
    return this.structure.removeLesson(user, id, meta);
  }
}
