import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  AssessmentAttempt,
  AssignmentSubmission,
  AuditLog,
  Course,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Role,
  RoleName,
  Session,
  User,
  UserStatus,
} from '../../database/entities';
import { escapeLike, PageResult, skipTake } from '../../common/dto/pagination';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { CoursesService } from '../courses/courses.service';
import { toUserDto } from '../users/user.mapper';
import {
  AdminCreateUserDto,
  AdminListCoursesQueryDto,
  AdminUpdateUserDto,
  ListAuditQueryDto,
  ListUsersQueryDto,
} from './dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(AssessmentAttempt) private readonly attempts: Repository<AssessmentAttempt>,
    @InjectRepository(AssignmentSubmission)
    private readonly submissions: Repository<AssignmentSubmission>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly courseSvc: CoursesService,
  ) {}

  async listUsers(q: ListUsersQueryDto) {
    // Filter/page on ids first (bounded), then load full rows with all roles.
    const base = this.users.createQueryBuilder('u');
    if (q.role) base.innerJoin('u.roles', 'rf', 'rf.name = :role', { role: q.role });
    if (q.status) base.andWhere('u.status = :status', { status: q.status });
    if (q.q)
      base.andWhere('(u.email LIKE :t OR u.fullName LIKE :t)', { t: `%${escapeLike(q.q)}%` });
    const total = await base.clone().getCount();
    const ids = await base
      .clone()
      .select('u.id', 'id')
      .addSelect('u.createdAt', 'createdAt')
      .orderBy('u.createdAt', 'DESC')
      .addOrderBy('u.id', 'ASC')
      .offset(skipTake(q).skip)
      .limit(q.pageSize)
      .getRawMany<{ id: string }>();
    const rows = ids.length
      ? await this.users.find({ where: { id: In(ids.map((i) => i.id)) } })
      : [];
    const order = new Map(ids.map((u, i) => [u.id, i]));
    rows.sort((x, y) => order.get(x.id)! - order.get(y.id)!);
    return PageResult.of(rows.map(toUserDto), total, q);
  }

  async getUser(id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
    return toUserDto(u);
  }

  private async resolveRoles(names: RoleName[]): Promise<Role[]> {
    const unique = [...new Set(names)];
    const found = await this.roles.find({ where: { name: In(unique) } });
    if (found.length !== unique.length) throw new BadRequestException('Unknown role');
    return found;
  }

  async createUser(actor: AuthUser, dto: AdminCreateUserDto, meta: RequestMeta) {
    if (await this.users.exist({ where: { email: dto.email } }))
      throw new ConflictException('A user with this e-mail already exists');
    const user = await this.users.save(
      this.users.create({
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.password),
        fullName: cleanText(dto.fullName),
        roles: await this.resolveRoles(dto.roles),
        passwordChangedAt: new Date(),
      }),
    );
    await this.audit.record({
      actorId: actor.id,
      action: 'ADMIN_USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { roles: dto.roles },
      meta,
    });
    return this.getUser(user.id);
  }

  async updateUser(actor: AuthUser, id: string, dto: AdminUpdateUserDto, meta: RequestMeta) {
    // Everything runs in one transaction with the admin rows locked, so two concurrent requests cannot
    // both pass the "last active administrator" check and leave the system without an admin.
    await this.dataSource.transaction(async (em) => {
      const userRepo = em.getRepository(User);
      // Fixed lock order (all administrators by id, then the target) so concurrent admin updates
      // serialise instead of deadlocking, and the "last active administrator" count cannot go stale.
      const lockedAdmins = await userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.status'])
        .innerJoin('u.roles', 'r')
        .setLock('pessimistic_write')
        .where('r.name = :n', { n: RoleName.ADMIN })
        .orderBy('u.id', 'ASC')
        .getMany();
      const activeAdmins = lockedAdmins.filter((a) => a.status === UserStatus.ACTIVE).length;
      const user = await userRepo
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :id', { id })
        .getOne();
      if (!user) throw new NotFoundException('User not found');
      const withRoles = await userRepo.findOneOrFail({ where: { id } });
      const isAdminUser = withRoles.roles.some((r) => r.name === RoleName.ADMIN);
      const isSelf = actor.id === id;
      const losingAdmin =
        dto.roles !== undefined && !dto.roles.includes(RoleName.ADMIN) && isAdminUser;
      const suspending = dto.status === UserStatus.SUSPENDED;
      if (isSelf && (losingAdmin || suspending))
        throw new ConflictException('Administrators cannot demote or suspend themselves');
      if ((losingAdmin || (suspending && isAdminUser)) && activeAdmins <= 1)
        throw new ConflictException('Cannot remove the last active administrator');
      const changed: string[] = [];
      if (dto.fullName !== undefined) {
        withRoles.fullName = cleanText(dto.fullName);
        changed.push('fullName');
      }
      if (dto.status !== undefined) {
        withRoles.status = dto.status;
        changed.push('status');
      }
      if (dto.roles !== undefined) {
        withRoles.roles = await this.resolveRoles(dto.roles);
        changed.push('roles');
      }
      await userRepo.save(withRoles);
      if (suspending || dto.roles !== undefined) {
        // Privilege/state change: force re-authentication everywhere.
        await em
          .getRepository(Session)
          .update({ userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'ADMIN_USER_UPDATED',
          entityType: 'User',
          entityId: id,
          metadata: { changes: changed, status: dto.status, roles: dto.roles },
          meta,
        },
        em,
      );
    });
    return this.getUser(id);
  }

  async listCourses(q: AdminListCoursesQueryDto) {
    const qb = this.courses.createQueryBuilder('c').leftJoinAndSelect('c.instructor', 'i');
    if (q.status) qb.andWhere('c.status = :status', { status: q.status });
    if (q.q) qb.andWhere('(c.title LIKE :t OR c.summary LIKE :t)', { t: `%${escapeLike(q.q)}%` });
    const [rows, total] = await qb
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    const counts = await this.courseSvc.countLessonsFor(rows.map((r) => r.id));
    return PageResult.of(
      rows.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
        level: c.level,
        publishedAt: c.publishedAt,
        createdAt: c.createdAt,
        instructor: { id: c.instructor.id, fullName: c.instructor.fullName },
        lessonCount: counts.get(c.id) ?? 0,
      })),
      total,
      q,
    );
  }

  async stats() {
    const byRole = await this.users
      .createQueryBuilder('u')
      .innerJoin('u.roles', 'r')
      .select('r.name', 'role')
      .addSelect('COUNT(*)', 'n')
      .groupBy('r.name')
      .getRawMany<{ role: string; n: string }>();
    const byStatus = await this.courses
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .groupBy('c.status')
      .getRawMany<{ status: string; n: string }>();
    const toMap = (rows: { n: string }[], key: string) =>
      Object.fromEntries(
        rows.map((r) => [(r as unknown as Record<string, string>)[key], Number(r.n)]),
      );
    return {
      users: { total: await this.users.count(), byRole: toMap(byRole, 'role') },
      courses: {
        total: await this.courses.count(),
        byStatus: { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0, ...toMap(byStatus, 'status') } as Record<
          CourseStatus,
          number
        >,
      },
      enrollments: {
        active: await this.enrollments.count({ where: { status: EnrollmentStatus.ACTIVE } }),
        completed: await this.enrollments.count({ where: { status: EnrollmentStatus.COMPLETED } }),
      },
      assessmentAttempts: await this.attempts.count(),
      assignmentSubmissions: await this.submissions.count(),
    };
  }

  async auditLogs(q: ListAuditQueryDto) {
    const qb = this.auditRepo.createQueryBuilder('a');
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    if (q.actorId) qb.andWhere('a.actorId = :actorId', { actorId: q.actorId });
    if (q.entityType) qb.andWhere('a.entityType = :et', { et: q.entityType });
    const [rows, total] = await qb
      .orderBy('a.createdAt', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip(skipTake(q).skip)
      .take(q.pageSize)
      .getManyAndCount();
    return PageResult.of(rows, total, q);
  }
}
