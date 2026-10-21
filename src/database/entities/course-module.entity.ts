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
import { Lesson } from './lesson.entity';

@Entity('course_modules')
@Index('idx_modules_course_position', ['courseId', 'position'])
export class CourseModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'char', length: 36 })
  courseId!: string;

  @ManyToOne(() => Course, (c) => c.modules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_modules_course' })
  course!: Course;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description!: string | null;

  @Column({ type: 'int', unsigned: true, default: 0 })
  position!: number;

  @OneToMany(() => Lesson, (l) => l.module)
  lessons!: Lesson[];

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
