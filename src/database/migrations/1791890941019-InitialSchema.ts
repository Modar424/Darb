import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791890941019 implements MigrationInterface {
  name = 'InitialSchema1791890941019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`roles\` (\`id\` int UNSIGNED NOT NULL AUTO_INCREMENT, \`name\` enum ('ADMIN', 'INSTRUCTOR', 'STUDENT') NOT NULL, UNIQUE INDEX \`IDX_648e3f5447f725579d7d4ffdfb\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`email\` varchar(254) NOT NULL, \`password_hash\` varchar(255) NOT NULL, \`full_name\` varchar(120) NOT NULL, \`bio\` varchar(1000) NULL, \`locale\` varchar(5) NOT NULL DEFAULT 'ar', \`status\` enum ('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE', \`failed_login_count\` int UNSIGNED NOT NULL DEFAULT '0', \`locked_until\` datetime(3) NULL, \`last_login_at\` datetime(3) NULL, \`password_changed_at\` datetime(3) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_users_status_created\` (\`status\`, \`created_at\`), UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`sessions\` (\`id\` varchar(36) NOT NULL, \`token_hash\` char(64) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`expires_at\` datetime(3) NOT NULL, \`absolute_expires_at\` datetime(3) NOT NULL, \`last_seen_at\` datetime(3) NOT NULL, \`revoked_at\` datetime(3) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` varchar(255) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`idx_sessions_expiry\` (\`absolute_expires_at\`), INDEX \`idx_sessions_user\` (\`user_id\`, \`revoked_at\`), UNIQUE INDEX \`IDX_abaa9e068cdd390bc5210f7988\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`password_reset_tokens\` (\`id\` varchar(36) NOT NULL, \`token_hash\` char(64) NOT NULL, \`user_id\` varchar(36) NOT NULL, \`expires_at\` datetime(3) NOT NULL, \`used_at\` datetime(3) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`idx_prt_user\` (\`user_id\`), UNIQUE INDEX \`IDX_91185d86d5d7557b19abbb2868\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`lessons\` (\`id\` varchar(36) NOT NULL, \`module_id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`title\` varchar(160) NOT NULL, \`content_type\` enum ('TEXT', 'VIDEO', 'LINK') NOT NULL DEFAULT 'TEXT', \`content\` mediumtext NULL, \`content_url\` varchar(500) NULL, \`duration_minutes\` int UNSIGNED NOT NULL DEFAULT '0', \`is_preview\` tinyint NOT NULL DEFAULT 0, \`position\` int UNSIGNED NOT NULL DEFAULT '0', \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_lessons_course\` (\`course_id\`), INDEX \`idx_lessons_module_position\` (\`module_id\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`course_modules\` (\`id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`title\` varchar(160) NOT NULL, \`description\` varchar(1000) NULL, \`position\` int UNSIGNED NOT NULL DEFAULT '0', \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_modules_course_position\` (\`course_id\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`courses\` (\`id\` varchar(36) NOT NULL, \`title\` varchar(160) NOT NULL, \`slug\` varchar(190) NOT NULL, \`summary\` varchar(500) NOT NULL, \`description\` text NOT NULL, \`level\` enum ('BEGINNER', 'INTERMEDIATE', 'ADVANCED') NOT NULL DEFAULT 'BEGINNER', \`language\` varchar(5) NOT NULL DEFAULT 'ar', \`status\` enum ('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT', \`instructor_id\` varchar(36) NOT NULL, \`published_at\` datetime(3) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_courses_instructor\` (\`instructor_id\`, \`status\`), INDEX \`idx_courses_status_published\` (\`status\`, \`published_at\`), UNIQUE INDEX \`IDX_a3bb2d01cfa0f95bc5e034e1b7\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`enrollments\` (\`id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`student_id\` varchar(36) NOT NULL, \`status\` enum ('ACTIVE', 'COMPLETED', 'DROPPED') NOT NULL DEFAULT 'ACTIVE', \`enrolled_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`completed_at\` datetime(3) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_enrollments_student\` (\`student_id\`, \`status\`), UNIQUE INDEX \`uq_enrollment_course_student\` (\`course_id\`, \`student_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`questions\` (\`id\` varchar(36) NOT NULL, \`assessment_id\` varchar(36) NOT NULL, \`type\` enum ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE') NOT NULL, \`prompt\` text NOT NULL, \`options\` json NOT NULL, \`correct_option_ids\` json NOT NULL, \`explanation\` text NULL, \`points\` int UNSIGNED NOT NULL DEFAULT '1', \`position\` int UNSIGNED NOT NULL DEFAULT '0', \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_questions_assessment_position\` (\`assessment_id\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assessments\` (\`id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`module_id\` varchar(36) NULL, \`title\` varchar(160) NOT NULL, \`instructions\` text NULL, \`status\` enum ('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT', \`time_limit_minutes\` int UNSIGNED NULL, \`max_attempts\` int UNSIGNED NOT NULL DEFAULT '1', \`passing_percent\` int UNSIGNED NOT NULL DEFAULT '60', \`available_from\` datetime(3) NULL, \`due_at\` datetime(3) NULL, \`review_policy\` enum ('AFTER_SUBMISSION', 'NEVER') NOT NULL DEFAULT 'AFTER_SUBMISSION', \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_assessments_course_status\` (\`course_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assessment_attempts\` (\`id\` varchar(36) NOT NULL, \`assessment_id\` varchar(36) NOT NULL, \`student_id\` varchar(36) NOT NULL, \`attempt_number\` int UNSIGNED NOT NULL, \`status\` enum ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS', \`started_at\` datetime(3) NOT NULL, \`deadline_at\` datetime(3) NULL, \`submitted_at\` datetime(3) NULL, \`answers\` json NULL, \`score\` int UNSIGNED NULL, \`max_score\` int UNSIGNED NULL, \`percent\` int UNSIGNED NULL, \`passed\` tinyint NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_attempts_student\` (\`student_id\`, \`status\`), UNIQUE INDEX \`uq_attempt_number\` (\`assessment_id\`, \`student_id\`, \`attempt_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assignments\` (\`id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`module_id\` varchar(36) NULL, \`title\` varchar(160) NOT NULL, \`instructions\` text NOT NULL, \`status\` enum ('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT', \`max_points\` int UNSIGNED NOT NULL DEFAULT '100', \`due_at\` datetime(3) NULL, \`allow_late\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_assignments_course_status\` (\`course_id\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assignment_submissions\` (\`id\` varchar(36) NOT NULL, \`assignment_id\` varchar(36) NOT NULL, \`student_id\` varchar(36) NOT NULL, \`content\` text NOT NULL, \`link_url\` varchar(500) NULL, \`status\` enum ('SUBMITTED', 'GRADED') NOT NULL DEFAULT 'SUBMITTED', \`submitted_at\` datetime(3) NOT NULL, \`is_late\` tinyint NOT NULL DEFAULT 0, \`grade\` int UNSIGNED NULL, \`feedback\` text NULL, \`graded_by_id\` varchar(36) NULL, \`graded_at\` datetime(3) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`updated_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), INDEX \`idx_submissions_assignment_status\` (\`assignment_id\`, \`status\`), INDEX \`idx_submissions_student\` (\`student_id\`), UNIQUE INDEX \`uq_submission_assignment_student\` (\`assignment_id\`, \`student_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`progress_records\` (\`id\` varchar(36) NOT NULL, \`student_id\` varchar(36) NOT NULL, \`course_id\` varchar(36) NOT NULL, \`lesson_id\` varchar(36) NOT NULL, \`completed_at\` datetime(3) NOT NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`idx_progress_course_student\` (\`course_id\`, \`student_id\`), UNIQUE INDEX \`uq_progress_student_lesson\` (\`student_id\`, \`lesson_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`audit_logs\` (\`id\` bigint UNSIGNED NOT NULL AUTO_INCREMENT, \`actor_id\` varchar(36) NULL, \`action\` varchar(80) NOT NULL, \`entity_type\` varchar(60) NULL, \`entity_id\` varchar(64) NULL, \`metadata\` json NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` varchar(255) NULL, \`created_at\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX \`idx_audit_entity\` (\`entity_type\`, \`entity_id\`), INDEX \`idx_audit_action_created\` (\`action\`, \`created_at\`), INDEX \`idx_audit_actor_created\` (\`actor_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`user_roles\` (\`user_id\` varchar(36) NOT NULL, \`role_id\` int UNSIGNED NOT NULL, INDEX \`IDX_87b8888186ca9769c960e92687\` (\`user_id\`), INDEX \`IDX_b23c65e50a758245a33ee35fda\` (\`role_id\`), PRIMARY KEY (\`user_id\`, \`role_id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`sessions\` ADD CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` ADD CONSTRAINT \`fk_prt_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`lessons\` ADD CONSTRAINT \`fk_lessons_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`course_modules\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`lessons\` ADD CONSTRAINT \`fk_lessons_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`course_modules\` ADD CONSTRAINT \`fk_modules_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`courses\` ADD CONSTRAINT \`fk_courses_instructor\` FOREIGN KEY (\`instructor_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`enrollments\` ADD CONSTRAINT \`fk_enrollments_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`enrollments\` ADD CONSTRAINT \`fk_enrollments_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`questions\` ADD CONSTRAINT \`fk_questions_assessment\` FOREIGN KEY (\`assessment_id\`) REFERENCES \`assessments\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessments\` ADD CONSTRAINT \`fk_assessments_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessments\` ADD CONSTRAINT \`fk_assessments_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`course_modules\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessment_attempts\` ADD CONSTRAINT \`fk_attempts_assessment\` FOREIGN KEY (\`assessment_id\`) REFERENCES \`assessments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessment_attempts\` ADD CONSTRAINT \`fk_attempts_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignments\` ADD CONSTRAINT \`fk_assignments_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignments\` ADD CONSTRAINT \`fk_assignments_module\` FOREIGN KEY (\`module_id\`) REFERENCES \`course_modules\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` ADD CONSTRAINT \`fk_submissions_assignment\` FOREIGN KEY (\`assignment_id\`) REFERENCES \`assignments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` ADD CONSTRAINT \`fk_submissions_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` ADD CONSTRAINT \`fk_submissions_grader\` FOREIGN KEY (\`graded_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` ADD CONSTRAINT \`fk_progress_student\` FOREIGN KEY (\`student_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` ADD CONSTRAINT \`fk_progress_course\` FOREIGN KEY (\`course_id\`) REFERENCES \`courses\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` ADD CONSTRAINT \`fk_progress_lesson\` FOREIGN KEY (\`lesson_id\`) REFERENCES \`lessons\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`audit_logs\` ADD CONSTRAINT \`fk_audit_actor\` FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`fk_user_roles_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_roles\` ADD CONSTRAINT \`fk_user_roles_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`fk_user_roles_role\``);
    await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`fk_user_roles_user\``);
    await queryRunner.query(`ALTER TABLE \`audit_logs\` DROP FOREIGN KEY \`fk_audit_actor\``);
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` DROP FOREIGN KEY \`fk_progress_lesson\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` DROP FOREIGN KEY \`fk_progress_course\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`progress_records\` DROP FOREIGN KEY \`fk_progress_student\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` DROP FOREIGN KEY \`fk_submissions_grader\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` DROP FOREIGN KEY \`fk_submissions_student\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignment_submissions\` DROP FOREIGN KEY \`fk_submissions_assignment\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignments\` DROP FOREIGN KEY \`fk_assignments_module\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assignments\` DROP FOREIGN KEY \`fk_assignments_course\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessment_attempts\` DROP FOREIGN KEY \`fk_attempts_student\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessment_attempts\` DROP FOREIGN KEY \`fk_attempts_assessment\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessments\` DROP FOREIGN KEY \`fk_assessments_module\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assessments\` DROP FOREIGN KEY \`fk_assessments_course\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`questions\` DROP FOREIGN KEY \`fk_questions_assessment\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`enrollments\` DROP FOREIGN KEY \`fk_enrollments_student\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`enrollments\` DROP FOREIGN KEY \`fk_enrollments_course\``,
    );
    await queryRunner.query(`ALTER TABLE \`courses\` DROP FOREIGN KEY \`fk_courses_instructor\``);
    await queryRunner.query(
      `ALTER TABLE \`course_modules\` DROP FOREIGN KEY \`fk_modules_course\``,
    );
    await queryRunner.query(`ALTER TABLE \`lessons\` DROP FOREIGN KEY \`fk_lessons_course\``);
    await queryRunner.query(`ALTER TABLE \`lessons\` DROP FOREIGN KEY \`fk_lessons_module\``);
    await queryRunner.query(
      `ALTER TABLE \`password_reset_tokens\` DROP FOREIGN KEY \`fk_prt_user\``,
    );
    await queryRunner.query(`ALTER TABLE \`sessions\` DROP FOREIGN KEY \`fk_sessions_user\``);
    await queryRunner.query(`DROP INDEX \`IDX_b23c65e50a758245a33ee35fda\` ON \`user_roles\``);
    await queryRunner.query(`DROP INDEX \`IDX_87b8888186ca9769c960e92687\` ON \`user_roles\``);
    await queryRunner.query(`DROP TABLE \`user_roles\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_actor_created\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_action_created\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_entity\` ON \`audit_logs\``);
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`uq_progress_student_lesson\` ON \`progress_records\``);
    await queryRunner.query(`DROP INDEX \`idx_progress_course_student\` ON \`progress_records\``);
    await queryRunner.query(`DROP TABLE \`progress_records\``);
    await queryRunner.query(
      `DROP INDEX \`uq_submission_assignment_student\` ON \`assignment_submissions\``,
    );
    await queryRunner.query(`DROP INDEX \`idx_submissions_student\` ON \`assignment_submissions\``);
    await queryRunner.query(
      `DROP INDEX \`idx_submissions_assignment_status\` ON \`assignment_submissions\``,
    );
    await queryRunner.query(`DROP TABLE \`assignment_submissions\``);
    await queryRunner.query(`DROP INDEX \`idx_assignments_course_status\` ON \`assignments\``);
    await queryRunner.query(`DROP TABLE \`assignments\``);
    await queryRunner.query(`DROP INDEX \`uq_attempt_number\` ON \`assessment_attempts\``);
    await queryRunner.query(`DROP INDEX \`idx_attempts_student\` ON \`assessment_attempts\``);
    await queryRunner.query(`DROP TABLE \`assessment_attempts\``);
    await queryRunner.query(`DROP INDEX \`idx_assessments_course_status\` ON \`assessments\``);
    await queryRunner.query(`DROP TABLE \`assessments\``);
    await queryRunner.query(`DROP INDEX \`idx_questions_assessment_position\` ON \`questions\``);
    await queryRunner.query(`DROP TABLE \`questions\``);
    await queryRunner.query(`DROP INDEX \`uq_enrollment_course_student\` ON \`enrollments\``);
    await queryRunner.query(`DROP INDEX \`idx_enrollments_student\` ON \`enrollments\``);
    await queryRunner.query(`DROP TABLE \`enrollments\``);
    await queryRunner.query(`DROP INDEX \`IDX_a3bb2d01cfa0f95bc5e034e1b7\` ON \`courses\``);
    await queryRunner.query(`DROP INDEX \`idx_courses_status_published\` ON \`courses\``);
    await queryRunner.query(`DROP INDEX \`idx_courses_instructor\` ON \`courses\``);
    await queryRunner.query(`DROP TABLE \`courses\``);
    await queryRunner.query(`DROP INDEX \`idx_modules_course_position\` ON \`course_modules\``);
    await queryRunner.query(`DROP TABLE \`course_modules\``);
    await queryRunner.query(`DROP INDEX \`idx_lessons_module_position\` ON \`lessons\``);
    await queryRunner.query(`DROP INDEX \`idx_lessons_course\` ON \`lessons\``);
    await queryRunner.query(`DROP TABLE \`lessons\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_91185d86d5d7557b19abbb2868\` ON \`password_reset_tokens\``,
    );
    await queryRunner.query(`DROP INDEX \`idx_prt_user\` ON \`password_reset_tokens\``);
    await queryRunner.query(`DROP TABLE \`password_reset_tokens\``);
    await queryRunner.query(`DROP INDEX \`IDX_abaa9e068cdd390bc5210f7988\` ON \`sessions\``);
    await queryRunner.query(`DROP INDEX \`idx_sessions_user\` ON \`sessions\``);
    await queryRunner.query(`DROP INDEX \`idx_sessions_expiry\` ON \`sessions\``);
    await queryRunner.query(`DROP TABLE \`sessions\``);
    await queryRunner.query(`DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``);
    await queryRunner.query(`DROP INDEX \`idx_users_status_created\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP INDEX \`IDX_648e3f5447f725579d7d4ffdfb\` ON \`roles\``);
    await queryRunner.query(`DROP TABLE \`roles\``);
  }
}
