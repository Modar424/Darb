import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Assessment } from './assessment.entity';
import { User } from './user.entity';
import { AttemptStatus } from './enums';

export type AttemptAnswers = Record<string, string[]>;

@Entity('assessment_attempts')
@Unique('uq_attempt_number', ['assessmentId', 'studentId', 'attemptNumber'])
@Index('idx_attempts_student', ['studentId', 'status'])
export class AssessmentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assessment_id', type: 'char', length: 36 })
  assessmentId!: string;

  @ManyToOne(() => Assessment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assessment_id', foreignKeyConstraintName: 'fk_attempts_assessment' })
  assessment!: Assessment;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_attempts_student' })
  student!: User;

  @Column({ name: 'attempt_number', type: 'int', unsigned: true })
  attemptNumber!: number;

  @Column({ type: 'enum', enum: AttemptStatus, default: AttemptStatus.IN_PROGRESS })
  status!: AttemptStatus;

  @Column({ name: 'started_at', type: 'datetime', precision: 3 })
  startedAt!: Date;

  /** Server-calculated deadline for this attempt (time limit and/or assessment due date). */
  @Column({ name: 'deadline_at', type: 'datetime', precision: 3, nullable: true })
  deadlineAt!: Date | null;

  @Column({ name: 'submitted_at', type: 'datetime', precision: 3, nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'json', nullable: true })
  answers!: AttemptAnswers | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  score!: number | null;

  @Column({ name: 'max_score', type: 'int', unsigned: true, nullable: true })
  maxScore!: number | null;

  @Column({ type: 'int', unsigned: true, nullable: true })
  percent!: number | null;

  @Column({ type: 'boolean', nullable: true })
  passed!: boolean | null;

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
