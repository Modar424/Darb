import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestContextMiddleware } from './common/logging/request-context.middleware';
import { AppConfigModule } from './config/config.module';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { dataSourceOptionsFromConfig } from './database/options';
import { AdminModule } from './modules/admin/admin.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CsrfGuard, RolesGuard, SessionAuthGuard } from './modules/auth/guards';
import { CoursesModule } from './modules/courses/courses.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { HealthController } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.module';
import { ProgressModule } from './modules/progress/progress.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => dataSourceOptionsFromConfig(cfg),
    }),
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        throttlers: [{ ttl: cfg.throttle.ttlSeconds * 1000, limit: cfg.throttle.limit }],
      }),
    }),
    AuditModule,
    MailModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    ProgressModule,
    EnrollmentsModule,
    AssessmentsModule,
    AssignmentsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guard order matters: rate limit -> authenticate -> CSRF/origin -> roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        validationError: { target: false, value: false },
        exceptionFactory: undefined,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*path');
  }
}
