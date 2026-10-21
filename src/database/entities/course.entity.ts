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
import { User } from './user.entity';
import { CourseLevel, CourseStatus } from './enums';
import { CourseModule } from './course-module.entity';

@Entity('courses')
@Index('idx_courses_status_published', ['status', 'publishedAt'])
@Index('idx_courses_instructor', ['instructorId', 'status'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 190, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 500 })
  summary!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: CourseLevel, default: CourseLevel.BEGINNER })
  level!: CourseLevel;

  @Column({ type: 'varchar', length: 5, default: 'ar' })
  language!: string;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  status!: CourseStatus;

  @Column({ name: 'instructor_id', type: 'char', length: 36 })
  instructorId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'instructor_id', foreignKeyConstraintName: 'fk_courses_instructor' })
  instructor!: User;

  @OneToMany(() => CourseModule, (m) => m.course)
  modules!: CourseModule[];

  @Column({ name: 'published_at', type: 'datetime', precision: 3, nullable: true })
  publishedAt!: Date | null;

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
