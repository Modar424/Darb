'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api/endpoints';
import { errorKey, fieldErrors } from '@/lib/api/error-messages';
import { homeFor, safeNext } from '@/lib/roles';
import {
  fieldMessage,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Alert } from '@/components/ui/primitives';

function FormTitle({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {text && <p className="mt-1 text-muted">{text}</p>}
    </div>
  );
}

export function LoginForm() {
  const { t } = useI18n();
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const user = await login(v.email, v.password);
      router.replace(safeNext(params.get('next'), homeFor(user)));
    } catch (e) {
      setFormError(t(errorKey(e)));
    }
  });
  return (
    <>
      <FormTitle title={t('auth.loginTitle')} text={t('auth.loginText')} />
      {params.get('expired') && !formError && (
        <Alert tone="warning" className="mb-4">
          {t('auth.sessionExpired')}
        </Alert>
      )}
      {formError && (
        <Alert tone="danger" live className="mb-4">
          {formError}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.email)}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.password)}
          {...register('password')}
        />
        <Button type="submit" loading={formState.isSubmitting} size="lg">
          {t('auth.login')}
        </Button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <Link href="/forgot-password" className="text-ink-700 underline underline-offset-4">
          {t('auth.forgotLink')}
        </Link>
        <p className="text-muted">
          {t('auth.noAccount')}{' '}
          <Link
            href="/register"
            className="font-semibold text-ink-900 underline underline-offset-4"
          >
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </>
  );
}

export function RegisterForm() {
  const { t, locale } = useI18n();
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });
  const { register, handleSubmit, formState, setError } = form;

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const user = await signUp({ ...v, locale });
      router.replace(homeFor(user));
    } catch (e) {
      const fe = fieldErrors(e);
      let any = false;
      for (const f of ['email', 'password', 'fullName'] as const) {
        if (fe[f]) {
          setError(f, { message: f === 'password' ? 'val.password' : 'val.invalid' });
          any = true;
        }
      }
      if (!any) setFormError(t(errorKey(e)));
    }
  });
  return (
    <>
      <FormTitle title={t('auth.registerTitle')} text={t('auth.registerText')} />
      {formError && (
        <Alert tone="danger" live className="mb-4">
          {formError}
        </Alert>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label={t('auth.fullName')}
          autoComplete="name"
          required
          error={fieldMessage(t, formState.errors.fullName)}
          {...register('fullName')}
        />
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.email)}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          hint={t('auth.passwordHint')}
          error={fieldMessage(t, formState.errors.password)}
          {...register('password')}
        />
        <Button type="submit" loading={formState.isSubmitting} size="lg" variant="accent">
          {t('auth.createAccount')}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-ink-900 underline underline-offset-4">
          {t('auth.login')}
        </Link>
      </p>
    </>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });
  const { register, handleSubmit, formState } = form;
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await authApi.forgot(v);
      setSent(true);
    } catch (e) {
      setFormError(t(errorKey(e)));
    }
  });
  return (
    <>
      <FormTitle title={t('auth.forgotTitle')} text={t('auth.forgotText')} />
      {sent ? (
        // Identical outcome for every address: the UI never reveals whether the account exists.
        <Alert tone="success">{t('auth.forgotSent')}</Alert>
      ) : (
        <>
          {formError && (
            <Alert tone="danger" live className="mb-4">
              {formError}
            </Alert>
          )}
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Input
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              dir="ltr"
              required
              error={fieldMessage(t, formState.errors.email)}
              {...register('email')}
            />
            <Button type="submit" loading={formState.isSubmitting} size="lg">
              {t('auth.sendLink')}
            </Button>
          </form>
        </>
      )}
      <p className="mt-5 text-sm">
        <Link href="/login" className="text-ink-700 underline underline-offset-4">
          {t('auth.backToLogin')}
        </Link>
      </p>
    </>
  );
}

export function ResetForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const { register, handleSubmit, formState } = form;
  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    try {
      await authApi.reset({ token, newPassword: v.password });
      setDone(true);
    } catch (e) {
      setFormError(t(errorKey(e)));
    }
  });
  if (token.length < 20) {
    return (
      <>
        <FormTitle title={t('auth.resetTitle')} />
        <Alert tone="danger" live>
          {t('err.resetToken')}
        </Alert>
        <p className="mt-5 text-sm">
          <Link href="/forgot-password" className="text-ink-700 underline underline-offset-4">
            {t('auth.forgotLink')}
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <FormTitle title={t('auth.resetTitle')} text={t('auth.resetText')} />
      {done ? (
        <>
          <Alert tone="success">{t('auth.resetDone')}</Alert>
          <p className="mt-5">
            <Link href="/login" className="font-semibold text-ink-900 underline underline-offset-4">
              {t('auth.login')}
            </Link>
          </p>
        </>
      ) : (
        <>
          {formError && (
            <Alert tone="danger" live className="mb-4">
              {formError}
            </Alert>
          )}
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
            <Button type="submit" loading={formState.isSubmitting} size="lg">
              {t('auth.setPassword')}
            </Button>
          </form>
        </>
      )}
    </>
  );
}
