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

@Entity('audit_logs')
@Index('idx_audit_actor_created', ['actorId', 'createdAt'])
@Index('idx_audit_action_created', ['action', 'createdAt'])
@Index('idx_audit_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'actor_id', type: 'char', length: 36, nullable: true })
  actorId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'fk_audit_actor' })
  actor!: User | null;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 60, nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

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
