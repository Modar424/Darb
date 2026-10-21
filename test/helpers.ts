import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { Role, RoleName, User } from '../src/database/entities';
import { MailService } from '../src/modules/mail/mail.service';

export const PASSWORD = 'Test-Password-123!';
let cachedHash: string | null = null;

export async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  setupApp(app);
  await app.init();
  return app;
}

export async function resetDb(app: NestExpressApplication): Promise<void> {
  const ds = app.get(DataSource);
  await ds.query('SET FOREIGN_KEY_CHECKS = 0');
  const tables: { t: string }[] = await ds.query(
    `SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME NOT IN ('migrations','roles')`,
  );
  for (const { t } of tables) await ds.query(`TRUNCATE TABLE \`${t}\``);
  await ds.query('SET FOREIGN_KEY_CHECKS = 1');
}

let counter = 0;
export async function createUser(
  app: NestExpressApplication,
  role: RoleName,
  over: Partial<User> = {},
): Promise<User> {
  const ds = app.get(DataSource);
  cachedHash ??= await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 1024,
    timeCost: 1,
    parallelism: 1,
  });
  const r = await ds.getRepository(Role).findOneByOrFail({ name: role });
  counter += 1;
  return ds.getRepository(User).save(
    ds.getRepository(User).create({
      email: `${role.toLowerCase()}${counter}.${Date.now()}@example.test`,
      passwordHash: cachedHash,
      fullName: `Test ${role} ${counter}`,
      roles: [r],
      ...over,
    }),
  );
}

/** Cookie-jar client that automatically sends the CSRF token after login. */
export class Client {
  readonly agent: ReturnType<typeof request.agent>;
  csrf: string | null = null;
  /** Raw `Cookie` header captured at login (for replay tests). */
  cookieHeader = '';
  constructor(public readonly app: NestExpressApplication) {
    this.agent = request.agent(app.getHttpServer());
  }
  private p(path: string) {
    return `/api/v1${path}`;
  }
  async login(email: string, password = PASSWORD) {
    const res = await this.agent.post(this.p('/auth/login')).send({ email, password });
    if (res.status === 200) {
      this.csrf = res.body.data.csrfToken;
      const set = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
      this.cookieHeader = set.map((c) => c.split(';')[0]).join('; ');
    }
    return res;
  }
  get(path: string) {
    return this.agent.get(this.p(path));
  }
  post(path: string, body?: object) {
    return this.withCsrf(this.agent.post(this.p(path))).send(body ?? {});
  }
  put(path: string, body?: object) {
    return this.withCsrf(this.agent.put(this.p(path))).send(body ?? {});
  }
  patch(path: string, body?: object) {
    return this.withCsrf(this.agent.patch(this.p(path))).send(body ?? {});
  }
  delete(path: string) {
    return this.withCsrf(this.agent.delete(this.p(path)));
  }
  private withCsrf<T extends request.Test>(t: T): T {
    return this.csrf ? (t.set('X-CSRF-Token', this.csrf) as T) : t;
  }
}

export async function loggedIn(app: NestExpressApplication, user: User): Promise<Client> {
  const c = new Client(app);
  const res = await c.login(user.email);
  if (res.status !== 200) throw new Error(`login failed in test helper: ${res.status}`);
  return c;
}

export const mailOutbox = (app: NestExpressApplication) => app.get(MailService).outbox;

/** Creates a published course with 1 module and `lessons` lessons owned by `inst`. */
export async function publishedCourse(inst: Client, lessons = 2) {
  const c = await inst.post('/courses', {
    title: 'Test Course Title',
    summary: 'A summary that is long enough.',
    description: 'Description',
  });
  const courseId: string = c.body.data.id;
  const m = await inst.post(`/courses/${courseId}/modules`, { title: 'Module 1' });
  const lessonIds: string[] = [];
  for (let i = 0; i < lessons; i++) {
    const l = await inst.post(`/modules/${m.body.data.id}/lessons`, {
      title: `Lesson ${i + 1}`,
      content: 'Body text',
      isPreview: i === 0,
    });
    lessonIds.push(l.body.data.id);
  }
  const pub = await inst.post(`/courses/${courseId}/publish`);
  if (pub.status !== 200)
    throw new Error(`publish failed ${pub.status} ${JSON.stringify(pub.body)}`);
  return { courseId, moduleId: m.body.data.id as string, lessonIds };
}
