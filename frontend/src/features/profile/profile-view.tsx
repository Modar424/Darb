'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { authApi, usersApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useAuth } from '@/lib/auth';
import { changePasswordSchema, fieldMessage, profileSchema } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';

function ProfileForm() {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '', bio: user?.bio ?? '' },
  });
  const { register, handleSubmit, formState } = form;
  const onSubmit = handleSubmit(async (v) => {
    try {
      setUser(await usersApi.updateMe({ fullName: v.fullName, bio: v.bio }));
      toast.success(t('profile.saved'));
    } catch (e) {
      toast.error(t(errorKey(e)));
    }
  });
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">{t('profile.details')}</h2>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Input
          label={t('auth.fullName')}
          required
          error={fieldMessage(t, formState.errors.fullName)}
          {...register('fullName')}
        />
        <Input
          label={t('auth.email')}
          value={user?.email ?? ''}
          dir="ltr"
          readOnly
          disabled
          hint={t('profile.emailHint')}
        />
        <Textarea
          label={t('profile.bio')}
          rows={4}
          error={fieldMessage(t, formState.errors.bio)}
          {...register('bio')}
        />
        <div>
          <Button type="submit" loading={formState.isSubmitting}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const { t } = useI18n();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirm: '' },
  });
  const { register, handleSubmit, formState, reset } = form;
  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.password });
      toast.success(t('profile.passwordChanged'));
      reset();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold">{t('profile.security')}</h2>
      {error && (
        <Alert tone="danger" live className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <Input
          label={t('profile.currentPassword')}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.currentPassword)}
          {...register('currentPassword')}
        />
        <Input
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          hint={t('auth.passwordHint')}
          error={fieldMessage(t, formState.errors.password)}
          {...register('password')}
        />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.confirm)}
          {...register('confirm')}
        />
        <div>
          <Button type="submit" variant="secondary" loading={formState.isSubmitting}>
            {t('profile.changePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfileView() {
  const { t, date } = useI18n();
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title={t('profile.title')} />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted">
        {user.roles.map((r) => (
          <Badge key={r} tone="info">
            {t(`role.${r}`)}
          </Badge>
        ))}
        <span>{t('profile.memberSince', { date: date(user.createdAt) })}</span>
      </div>
      <div className="grid max-w-2xl gap-5">
        {/* key forces fresh default values after the user object arrives/changes */}
        <ProfileForm key={user.id} />
        <PasswordForm />
      </div>
    </>
  );
}
