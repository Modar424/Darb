import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import {
  Assessment,
  Assignment,
  Course,
  CourseModule,
  CourseStatus,
  Enrollment,
  EnrollmentStatus,
  Lesson,
  ProgressRecord,
  PublishStatus,
  Question,
  QuestionType,
  Role,
  RoleName,
  User,
} from '../entities';

/** Fictional demo data only (example.test addresses). Idempotent: skips if the admin user exists. */
export async function runSeed(ds: DataSource, password: string): Promise<{ created: boolean }> {
  const users = ds.getRepository(User);
  if (await users.exist({ where: { email: 'admin@example.test' } })) return { created: false };

  const roles = new Map((await ds.getRepository(Role).find()).map((r) => [r.name, r]));
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const mk = (email: string, fullName: string, role: RoleName) =>
    users.create({
      email,
      fullName,
      passwordHash: hash,
      roles: [roles.get(role)!],
      passwordChangedAt: new Date(),
    });

  const admin = await users.save(mk('admin@example.test', 'Demo Admin', RoleName.ADMIN));
  const [inst1, inst2] = await users.save([
    mk('instructor1@example.test', 'Demo Instructor One', RoleName.INSTRUCTOR),
    mk('instructor2@example.test', 'Demo Instructor Two', RoleName.INSTRUCTOR),
  ]);
  const students = await users.save(
    [1, 2, 3, 4, 5].map((i) =>
      mk(`student${i}@example.test`, `Demo Student ${i}`, RoleName.STUDENT),
    ),
  );

  const courseRepo = ds.getRepository(Course);
  const defs = [
    {
      title: 'Introduction to Web Development',
      slug: 'intro-web-development',
      owner: inst1,
      status: CourseStatus.PUBLISHED,
      level: undefined,
    },
    {
      title: 'Data Structures Fundamentals',
      slug: 'data-structures-fundamentals',
      owner: inst1,
      status: CourseStatus.PUBLISHED,
      level: undefined,
    },
    {
      title: 'Advanced Databases (draft)',
      slug: 'advanced-databases-draft',
      owner: inst2,
      status: CourseStatus.DRAFT,
      level: undefined,
    },
  ];
  const courses: Course[] = [];
  for (const d of defs) {
    courses.push(
      await courseRepo.save(
        courseRepo.create({
          title: d.title,
          slug: d.slug,
          summary: `${d.title}: a fictional demo course for local development.`,
          description:
            'Fictional course content used only for local development and automated tests.',
          instructorId: d.owner.id,
          status: d.status,
          language: 'en',
          publishedAt: d.status === CourseStatus.PUBLISHED ? new Date() : null,
        }),
      ),
    );
  }

  const lessonsByCourse = new Map<string, Lesson[]>();
  for (const course of courses) {
    const mod = await ds
      .getRepository(CourseModule)
      .save(
        ds
          .getRepository(CourseModule)
          .create({ courseId: course.id, title: 'Getting started', position: 1 }),
      );
    const ls: Lesson[] = [];
    for (let i = 1; i <= 3; i++) {
      ls.push(
        await ds.getRepository(Lesson).save(
          ds.getRepository(Lesson).create({
            moduleId: mod.id,
            courseId: course.id,
            title: `Lesson ${i}`,
            content: `Demo content for lesson ${i}.`,
            durationMinutes: 10,
            position: i,
            isPreview: i === 1,
          }),
        ),
      );
    }
    lessonsByCourse.set(course.id, ls);
  }

  const [web] = courses;
  const quiz = await ds.getRepository(Assessment).save(
    ds.getRepository(Assessment).create({
      courseId: web.id,
      title: 'Web basics quiz',
      instructions: 'Answer all questions.',
      status: PublishStatus.PUBLISHED,
      maxAttempts: 2,
      timeLimitMinutes: 15,
    }),
  );
  await ds.getRepository(Question).save([
    ds.getRepository(Question).create({
      assessmentId: quiz.id,
      type: QuestionType.SINGLE_CHOICE,
      prompt: 'Which language structures a web page?',
      position: 1,
      options: [
        { id: 'a', text: 'HTML' },
        { id: 'b', text: 'SQL' },
        { id: 'c', text: 'Bash' },
      ],
      correctOptionIds: ['a'],
      explanation: 'HTML defines page structure.',
    }),
    ds.getRepository(Question).create({
      assessmentId: quiz.id,
      type: QuestionType.TRUE_FALSE,
      prompt: 'CSS is used for styling.',
      position: 2,
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
      correctOptionIds: ['true'],
    }),
  ]);
  await ds.getRepository(Assignment).save(
    ds.getRepository(Assignment).create({
      courseId: web.id,
      title: 'Build a landing page',
      instructions: 'Submit a short description or a link to your page.',
      status: PublishStatus.PUBLISHED,
      allowLate: true,
    }),
  );

  const enrollRepo = ds.getRepository(Enrollment);
  for (const s of students.slice(0, 3)) {
    for (const c of courses.slice(0, 2))
      await enrollRepo.save(
        enrollRepo.create({ courseId: c.id, studentId: s.id, status: EnrollmentStatus.ACTIVE }),
      );
  }
  const first = lessonsByCourse.get(web.id)!;
  await ds.getRepository(ProgressRecord).save(
    first.slice(0, 2).map((l) =>
      ds.getRepository(ProgressRecord).create({
        studentId: students[0].id,
        courseId: web.id,
        lessonId: l.id,
        completedAt: new Date(),
      }),
    ),
  );
  void admin;
  return { created: true };
}
