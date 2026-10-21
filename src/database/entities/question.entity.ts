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
import { Assessment } from './assessment.entity';
import { QuestionType } from './enums';

export interface QuestionOption {
  id: string;
  text: string;
}

@Entity('questions')
@Index('idx_questions_assessment_position', ['assessmentId', 'position'])
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assessment_id', type: 'char', length: 36 })
  assessmentId!: string;

  @ManyToOne(() => Assessment, (a) => a.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assessment_id', foreignKeyConstraintName: 'fk_questions_assessment' })
  assessment!: Assessment;

  @Column({ type: 'enum', enum: QuestionType })
  type!: QuestionType;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'json' })
  options!: QuestionOption[];

  /** Option ids that make the answer correct. NEVER serialised to students before review is permitted. */
  @Column({ name: 'correct_option_ids', type: 'json', select: false })
  correctOptionIds!: string[];

  @Column({ type: 'text', nullable: true, select: false })
  explanation!: string | null;

  @Column({ type: 'int', unsigned: true, default: 1 })
  points!: number;

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
