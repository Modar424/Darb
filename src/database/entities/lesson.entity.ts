import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseModule } from './course-module.entity';
import { Course } from './course.entity';
import { LessonContentType } from './enums';

@Entity('lessons')
@Index('idx_lessons_module_position', ['moduleId', 'position'])
@Index('idx_lessons_course', ['courseId'])
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'module_id', type: 'char', length: 36 })
  moduleId!: string;

  @ManyToOne(() => CourseModule, (m) => m.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id', foreignKeyConstraintName: 'fk_lessons_module' })
  module!: CourseModule;

  /** Denormalised from the module to keep access checks and progress queries cheap. */
  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_lessons_course' })
  course!: Course;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({
    name: 'content_type',
    type: 'enum',
    enum: LessonContentType,
    default: LessonContentType.TEXT,
  })
  contentType!: LessonContentType;

  @Column({ type: 'mediumtext', nullable: true })
  content!: string | null;

  @Column({ name: 'content_url', type: 'varchar', length: 500, nullable: true })
  contentUrl!: string | null;

  @Column({ name: 'duration_minutes', type: 'int', unsigned: true, default: 0 })
  durationMinutes!: number;

  @Column({ name: 'is_preview', type: 'boolean', default: false })
  isPreview!: boolean;

  @Column({ type: 'int', unsigned: true, default: 0 })
  position!: number;

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
