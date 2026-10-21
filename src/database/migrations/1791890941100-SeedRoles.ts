import { MigrationInterface, QueryRunner } from 'typeorm';

/** Reference data required by the application (registration assigns STUDENT). Idempotent. */
export class SeedRoles1791890941100 implements MigrationInterface {
  name = 'SeedRoles1791890941100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT IGNORE INTO \`roles\` (\`name\`) VALUES ('ADMIN'), ('INSTRUCTOR'), ('STUDENT')`,
    );
  }

  public async down(): Promise<void> {
    // Roles are reference data; removing them would orphan user_roles. Intentionally a no-op.
  }
}
