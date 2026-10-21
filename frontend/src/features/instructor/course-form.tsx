'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { fieldMessage } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/field';
import type { CourseDetail } from '@/lib/api/types';

export const courseSchema = z.object({
  title: z.string().trim().min(3, 'val.titleLength').max(160, 'val.titleLength'),
  summary: z.string().trim().min(10, 'val.summaryLength').max(500, 'val.summaryLength'),
  description: z.string().trim().min(10, 'val.descriptionLength').max(20000, 'val.tooLong'),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  language: z.enum(['ar', 'en']),
});
export type CourseFormValues = z.infer<typeof courseSchema>;

export function CourseForm({
  course,
  submitLabel,
  onSubmit,
  disabled,
}: {
  course?: CourseDetail;
  submitLabel: string;
  onSubmit: (v: CourseFormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: course?.title ?? '',
      summary: course?.summary ?? '',
      description: course?.description ?? '',
      level: course?.level ?? 'BEGINNER',
      language: course?.language ?? locale,
    },
  });
  const { register, handleSubmit, formState } = form;
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid max-w-2xl gap-4">
      <Input
        label={t('course.fTitle')}
        required
        disabled={disabled}
        error={fieldMessage(t, formState.errors.title)}
        {...register('title')}
      />
      <Textarea
        label={t('course.fSummary')}
        rows={3}
        required
        disabled={disabled}
        hint={t('course.fSummaryHint')}
        error={fieldMessage(t, formState.errors.summary)}
        {...register('summary')}
      />
      <Textarea
        label={t('course.fDescription')}
        rows={8}
        required
        disabled={disabled}
        error={fieldMessage(t, formState.errors.description)}
        {...register('description')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('catalog.level')} disabled={disabled} {...register('level')}>
          <option value="BEGINNER">{t('level.BEGINNER')}</option>
          <option value="INTERMEDIATE">{t('level.INTERMEDIATE')}</option>
          <option value="ADVANCED">{t('level.ADVANCED')}</option>
        </Select>
        <Select label={t('catalog.language')} disabled={disabled} {...register('language')}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </Select>
      </div>
      <div>
        <Button type="submit" loading={formState.isSubmitting} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
