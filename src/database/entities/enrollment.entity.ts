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
import { Course } from './course.entity';
import { User } from './user.entity';
import { EnrollmentStatus } from './enums';

@Entity('enrollments')
@Unique('uq_enrollment_course_student', ['courseId', 'studentId'])
@Index('idx_enrollments_student', ['studentId', 'status'])
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_enrollments_course' })
  course!: Course;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_enrollments_student' })
  student!: User;

  @Column({ type: 'enum', enum: EnrollmentStatus, default: EnrollmentStatus.ACTIVE })
  status!: EnrollmentStatus;

  @Column({
    name: 'enrolled_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  enrolledAt!: Date;

  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;

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
