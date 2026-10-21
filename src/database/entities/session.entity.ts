import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sessions')
@Index('idx_sessions_user', ['userId', 'revokedAt'])
@Index('idx_sessions_expiry', ['absoluteExpiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** SHA-256 of the opaque session token; the raw token only exists in the cookie. */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_sessions_user' })
  user!: User;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @Column({ name: 'absolute_expires_at', type: 'datetime', precision: 3 })
  absoluteExpiresAt!: Date;

  @Column({ name: 'last_seen_at', type: 'datetime', precision: 3 })
  lastSeenAt!: Date;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
