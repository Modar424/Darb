import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Course } from './course.entity';
import { Lesson } from './lesson.entity';
import { User } from './user.entity';

@Entity('progress_records')
@Unique('uq_progress_student_lesson', ['studentId', 'lessonId'])
@Index('idx_progress_course_student', ['courseId', 'studentId'])
export class ProgressRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id', foreignKeyConstraintName: 'fk_progress_student' })
  student!: User;

  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_progress_course' })
  course!: Course;

  @Column({ name: 'lesson_id', type: 'char', length: 36 })
  lessonId!: string;

  @ManyToOne(() => Lesson, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', foreignKeyConstraintName: 'fk_progress_lesson' })
  lesson!: Lesson;

  @Column({ name: 'completed_at', type: 'datetime', precision: 3 })
  completedAt!: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;
}
