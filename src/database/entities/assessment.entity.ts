import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { CourseModule } from './course-module.entity';
import { PublishStatus, ReviewPolicy } from './enums';
import { Question } from './question.entity';

@Entity('assessments')
@Index('idx_assessments_course_status', ['courseId', 'status'])
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_assessments_course' })
  course!: Course;

  @Column({ name: 'module_id', type: 'char', length: 36, nullable: true })
  moduleId!: string | null;

  @ManyToOne(() => CourseModule, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'module_id', foreignKeyConstraintName: 'fk_assessments_module' })
  module!: CourseModule | null;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  instructions!: string | null;

  @Column({ type: 'enum', enum: PublishStatus, default: PublishStatus.DRAFT })
  status!: PublishStatus;

  @Column({ name: 'time_limit_minutes', type: 'int', unsigned: true, nullable: true })
  timeLimitMinutes!: number | null;

  @Column({ name: 'max_attempts', type: 'int', unsigned: true, default: 1 })
  maxAttempts!: number;

  @Column({ name: 'passing_percent', type: 'int', unsigned: true, default: 60 })
  passingPercent!: number;

  @Column({ name: 'available_from', type: 'datetime', precision: 3, nullable: true })
  availableFrom!: Date | null;

  @Column({ name: 'due_at', type: 'datetime', precision: 3, nullable: true })
  dueAt!: Date | null;

  @Column({
    name: 'review_policy',
    type: 'enum',
    enum: ReviewPolicy,
    default: ReviewPolicy.AFTER_SUBMISSION,
  })
  reviewPolicy!: ReviewPolicy;

  @OneToMany(() => Question, (q) => q.assessment)
  questions!: Question[];

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
