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
import { Assignment } from './assignment.entity';
import { User } from './user.entity';
import { SubmissionStatus } from './enums';

@Entity('assignment_submissions')
@Unique('uq_submission_assignment_student', ['assignmentId', 'studentId'])
@Index('idx_submissions_student', ['studentId'])
@Index('idx_submissions_assignment_status', ['assignmentId', 'status'])
export class AssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assignment_id', type: 'char', length: 36 })
  assignmentId!: string;

  @ManyToOne(() => Assignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id', foreignKeyConstraintName: 'fk_submissions_assignment' })
  assignment!: Assignment;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_submissions_student' })
  student!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  linkUrl!: string | null;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.SUBMITTED })
  status!: SubmissionStatus;

  @Column({ name: 'submitted_at', type: 'datetime', precision: 3 })
  submittedAt!: Date;

  @Column({ name: 'is_late', type: 'boolean', default: false })
  isLate!: boolean;

  @Column({ type: 'int', unsigned: true, nullable: true })
  grade!: number | null;

  @Column({ type: 'text', nullable: true })
  feedback!: string | null;

  @Column({ name: 'graded_by_id', type: 'char', length: 36, nullable: true })
  gradedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'graded_by_id', foreignKeyConstraintName: 'fk_submissions_grader' })
  gradedBy!: User | null;

  @Column({ name: 'graded_at', type: 'datetime', precision: 3, nullable: true })
  gradedAt!: Date | null;

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
