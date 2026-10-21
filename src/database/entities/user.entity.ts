import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { UserStatus } from './enums';

@Entity('users')
@Index('idx_users_status_created', ['status', 'createdAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 254, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 5, default: 'ar' })
  locale!: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: 'failed_login_count', type: 'int', unsigned: true, default: 0, select: false })
  failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'datetime', precision: 3, nullable: true, select: false })
  lockedUntil!: Date | null;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 3, nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'password_changed_at', type: 'datetime', precision: 3, nullable: true })
  passwordChangedAt!: Date | null;

  @ManyToMany(() => Role, { eager: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_user_roles_user',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_user_roles_role',
    },
  })
  roles!: Role[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;
}
