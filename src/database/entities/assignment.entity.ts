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
import { Course } from './course.entity';
import { CourseModule } from './course-module.entity';
import { PublishStatus } from './enums';

@Entity('assignments')
@Index('idx_assignments_course_status', ['courseId', 'status'])
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_assignments_course' })
  course!: Course;

  @Column({ name: 'module_id', type: 'char', length: 36, nullable: true })
  moduleId!: string | null;

  @ManyToOne(() => CourseModule, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'module_id', foreignKeyConstraintName: 'fk_assignments_module' })
  module!: CourseModule | null;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  instructions!: string;

  @Column({ type: 'enum', enum: PublishStatus, default: PublishStatus.DRAFT })
  status!: PublishStatus;

  @Column({ name: 'max_points', type: 'int', unsigned: true, default: 100 })
  maxPoints!: number;

  @Column({ name: 'due_at', type: 'datetime', precision: 3, nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'allow_late', type: 'boolean', default: false })
  allowLate!: boolean;

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
