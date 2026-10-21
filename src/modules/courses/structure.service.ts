import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Course,
  CourseModule,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  LessonContentType,
} from '../../database/entities';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { CourseAccessService } from './course-access.service';
import { CreateLessonDto, CreateModuleDto, UpdateLessonDto, UpdateModuleDto } from './dto';

@Injectable()
export class StructureService {
  constructor(
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  // ---------- modules ----------
  async createModule(user: AuthUser, courseId: string, dto: CreateModuleDto, meta: RequestMeta) {
    await this.access.getManageable(user, courseId);
    const max = await this.modules
      .createQueryBuilder('m')
      .select('COALESCE(MAX(m.position), 0)', 'max')
      .where('m.courseId = :courseId', { courseId })
      .getRawOne<{ max: string }>();
    const module = await this.modules.save(
      this.modules.create({
        courseId,
        title: cleanText(dto.title),
        description: dto.description ? cleanText(dto.description) : null,
        position: Number(max?.max ?? 0) + 1,
      }),
    );
    await this.audit.record({
      actorId: user.id,
      action: 'MODULE_CREATED',
      entityType: 'CourseModule',
      entityId: module.id,
      metadata: { courseId },
      meta,
    });
    return module;
  }

  private async getModuleForManage(
    user: AuthUser,
    moduleId: string,
  ): Promise<{ module: CourseModule; course: Course }> {
    const module = await this.modules.findOne({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('Module not found');
    const course = await this.access.getManageable(user, module.courseId);
    return { module, course };
  }

  async updateModule(user: AuthUser, moduleId: string, dto: UpdateModuleDto, meta: RequestMeta) {
    const { module } = await this.getModuleForManage(user, moduleId);
    if (dto.title !== undefined) module.title = cleanText(dto.title);
    if (dto.description !== undefined) module.description = cleanText(dto.description) || null;
    await this.modules.save(module);
    await this.audit.record({
      actorId: user.id,
      action: 'MODULE_UPDATED',
      entityType: 'CourseModule',
      entityId: module.id,
      meta,
    });
    return module;
  }

  async removeModule(user: AuthUser, moduleId: string, meta: RequestMeta) {
    const { module, course } = await this.getModuleForManage(user, moduleId);
    await this.assertStructureDeletable(course);
    await this.modules.delete({ id: module.id });
    await this.audit.record({
      actorId: user.id,
      action: 'MODULE_DELETED',
      entityType: 'CourseModule',
      entityId: module.id,
      metadata: { courseId: course.id },
      meta,
    });
    return { success: true };
  }

  async reorderModules(user: AuthUser, courseId: string, ids: string[], meta: RequestMeta) {
    await this.access.getManageable(user, courseId);
    await this.reorder(this.modules, { courseId }, ids);
    await this.audit.record({
      actorId: user.id,
      action: 'MODULES_REORDERED',
      entityType: 'Course',
      entityId: courseId,
      meta,
    });
    return { success: true };
  }

  // ---------- lessons ----------
  private validateContent(
    contentType: LessonContentType,
    content: string | null,
    contentUrl: string | null,
  ): void {
    if (contentType === LessonContentType.TEXT && !content)
      throw new BadRequestException('TEXT lessons require content');
    if (contentType !== LessonContentType.TEXT && !contentUrl) {
      throw new BadRequestException(`${contentType} lessons require contentUrl`);
    }
  }

  async createLesson(user: AuthUser, moduleId: string, dto: CreateLessonDto, meta: RequestMeta) {
    const { module } = await this.getModuleForManage(user, moduleId);
    const contentType = dto.contentType ?? LessonContentType.TEXT;
    const content = dto.content ? cleanText(dto.content) : null;
    const contentUrl = dto.contentUrl ?? null;
    this.validateContent(contentType, content, contentUrl);
    const max = await this.lessons
      .createQueryBuilder('l')
      .select('COALESCE(MAX(l.position), 0)', 'max')
      .where('l.moduleId = :moduleId', { moduleId })
      .getRawOne<{ max: string }>();
    const lesson = await this.dataSource.transaction(async (em) => {
      const created = await em.getRepository(Lesson).save(
        em.getRepository(Lesson).create({
          moduleId,
          courseId: module.courseId,
          title: cleanText(dto.title),
          contentType,
          content,
          contentUrl,
          durationMinutes: dto.durationMinutes ?? 0,
          isPreview: dto.isPreview ?? false,
          position: Number(max?.max ?? 0) + 1,
        }),
      );
      // A new lesson means learners who had finished are no longer at 100%: keep status consistent with progress
      // (same rule already applied when a learner un-completes a lesson).
      await em
        .getRepository(Enrollment)
        .update(
          { courseId: module.courseId, status: EnrollmentStatus.COMPLETED },
          { status: EnrollmentStatus.ACTIVE, completedAt: null },
        );
      return created;
    });
    await this.audit.record({
      actorId: user.id,
      action: 'LESSON_CREATED',
      entityType: 'Lesson',
      entityId: lesson.id,
      metadata: { courseId: module.courseId },
      meta,
    });
    return lesson;
  }

  async getLesson(user: AuthUser, lessonId: string) {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const course = await this.access.findOrThrow(lesson.courseId);
    if (this.access.canManage(user, course)) return lesson;
    if (course.status === CourseStatus.DRAFT) throw new NotFoundException('Lesson not found');
    const enrolled = await this.access.isEnrolled(user.id, course.id);
    if (enrolled || (lesson.isPreview && course.status === CourseStatus.PUBLISHED)) return lesson;
    throw new ForbiddenException('Enroll in this course to access this lesson');
  }

  async updateLesson(user: AuthUser, lessonId: string, dto: UpdateLessonDto, meta: RequestMeta) {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    await this.access.getManageable(user, lesson.courseId);
    if (dto.title !== undefined) lesson.title = cleanText(dto.title);
    if (dto.contentType !== undefined) lesson.contentType = dto.contentType;
    if (dto.content !== undefined) lesson.content = dto.content ? cleanText(dto.content) : null;
    if (dto.contentUrl !== undefined) lesson.contentUrl = dto.contentUrl;
    if (dto.durationMinutes !== undefined) lesson.durationMinutes = dto.durationMinutes;
    if (dto.isPreview !== undefined) lesson.isPreview = dto.isPreview;
    this.validateContent(lesson.contentType, lesson.content, lesson.contentUrl);
    await this.lessons.save(lesson);
    await this.audit.record({
      actorId: user.id,
      action: 'LESSON_UPDATED',
      entityType: 'Lesson',
      entityId: lesson.id,
      meta,
    });
    return lesson;
  }

  async removeLesson(user: AuthUser, lessonId: string, meta: RequestMeta) {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const course = await this.access.getManageable(user, lesson.courseId);
    await this.assertStructureDeletable(course);
    await this.lessons.delete({ id: lesson.id });
    await this.audit.record({
      actorId: user.id,
      action: 'LESSON_DELETED',
      entityType: 'Lesson',
      entityId: lesson.id,
      metadata: { courseId: course.id },
      meta,
    });
    return { success: true };
  }

  async reorderLessons(user: AuthUser, moduleId: string, ids: string[], meta: RequestMeta) {
    const { module } = await this.getModuleForManage(user, moduleId);
    await this.reorder(this.lessons, { moduleId }, ids);
    await this.audit.record({
      actorId: user.id,
      action: 'LESSONS_REORDERED',
      entityType: 'CourseModule',
      entityId: module.id,
      meta,
    });
    return { success: true };
  }

  // ---------- helpers ----------
  /** Removing content from a course that has learners would silently rewrite their progress. */
  private async assertStructureDeletable(course: Course): Promise<void> {
    if (await this.enrollments.exist({ where: { courseId: course.id } })) {
      throw new ConflictException('Course has enrollments; content cannot be deleted');
    }
  }

  private async reorder<T extends { id: string; position: number }>(
    repo: Repository<T>,
    scope: Record<string, string>,
    ids: string[],
  ): Promise<void> {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Duplicate ids in ordering');
    await this.dataSource.transaction(async (em) => {
      const manager = em.getRepository(repo.target);
      const existing = (await manager.find({
        where: scope as never,
        select: ['id'] as never,
      })) as unknown as { id: string }[];
      const existingIds = new Set(existing.map((e) => e.id));
      if (existingIds.size !== ids.length || ids.some((id) => !existingIds.has(id))) {
        throw new BadRequestException('ids must contain exactly the existing items');
      }
      for (let i = 0; i < ids.length; i++)
        await manager.update({ id: ids[i] } as never, { position: i + 1 } as never);
    });
  }
}
