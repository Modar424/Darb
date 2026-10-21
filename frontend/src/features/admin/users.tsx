'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { adminApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useAuth } from '@/lib/auth';
import { emailSchema, fieldMessage, nameSchema, passwordSchema } from '@/lib/validation';
import { useI18n } from '@/i18n/provider';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useDebounced } from '@/hooks/use-debounced';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { Alert, Badge, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { ErrorState } from '@/components/states';
import type { Role, User, UserStatus } from '@/lib/api/types';

const ROLES: Role[] = ['STUDENT', 'INSTRUCTOR', 'ADMIN'];

const createSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  roles: z.array(z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])).min(1, 'val.roleRequired'),
});
const editSchema = z.object({
  fullName: nameSchema,
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  roles: z.array(z.enum(['ADMIN', 'INSTRUCTOR', 'STUDENT'])).min(1, 'val.roleRequired'),
});

function RoleChecks({
  register,
  error,
}: {
  register: ReturnType<typeof useForm<{ roles: Role[] }>>['register'];
  error?: string;
}) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{t('admin.roles')}</legend>
      <div className="flex flex-wrap gap-x-5">
        {ROLES.map((r) => (
          <label key={r} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              value={r}
              className="size-5 accent-ink-900"
              {...register('roles')}
            />
            {t(`role.${r}`)}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof createSchema>, unknown, z.output<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { fullName: '', email: '', password: '', roles: ['STUDENT'] },
  });
  const { register, handleSubmit, formState, reset } = form;
  const save = handleSubmit(async (v) => {
    setError(null);
    try {
      await adminApi.createUser(v);
      await qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(t('admin.userCreated'));
      reset();
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!formState.isSubmitting}
      title={t('admin.createUser')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={formState.isSubmitting} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" live className="mb-3">
          {error}
        </Alert>
      )}
      <form onSubmit={save} noValidate className="grid gap-4">
        <Input
          label={t('auth.fullName')}
          required
          error={fieldMessage(t, formState.errors.fullName)}
          {...register('fullName')}
        />
        <Input
          label={t('auth.email')}
          type="email"
          dir="ltr"
          required
          error={fieldMessage(t, formState.errors.email)}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          dir="ltr"
          autoComplete="new-password"
          required
          hint={t('auth.passwordHint')}
          error={fieldMessage(t, formState.errors.password)}
          {...register('password')}
        />
        <RoleChecks
          register={register as never}
          error={fieldMessage(t, formState.errors.roles as { message?: string } | undefined)}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

function EditDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useI18n();
  const { user: me, setUser } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.input<typeof editSchema>, unknown, z.output<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    values: {
      fullName: user?.fullName ?? '',
      status: user?.status ?? 'ACTIVE',
      roles: user?.roles ?? ['STUDENT'],
    },
  });
  const { register, handleSubmit, formState } = form;
  const self = !!user && user.id === me?.id;
  const save = handleSubmit(async (v) => {
    if (!user) return;
    setError(null);
    try {
      const updated = await adminApi.updateUser(user.id, v);
      if (self) setUser(updated);
      await qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(t('common.saved'));
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    }
  });
  return (
    <Dialog
      open={!!user}
      onClose={onClose}
      dismissible={!formState.isSubmitting}
      title={t('admin.editUser')}
      description={user?.email}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={formState.isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button loading={formState.isSubmitting} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" live className="mb-3">
          {error}
        </Alert>
      )}
      {self && (
        <Alert tone="info" className="mb-3">
          {t('admin.selfNote')}
        </Alert>
      )}
      <form onSubmit={save} noValidate className="grid gap-4">
        <Input
          label={t('auth.fullName')}
          required
          error={fieldMessage(t, formState.errors.fullName)}
          {...register('fullName')}
        />
        <Select label={t('table.status')} disabled={self} {...register('status')}>
          <option value="ACTIVE">{t('userStatus.ACTIVE')}</option>
          <option value="SUSPENDED">{t('userStatus.SUSPENDED')}</option>
        </Select>
        <RoleChecks
          register={register as never}
          error={fieldMessage(t, formState.errors.roles as { message?: string } | undefined)}
        />
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}

export function AdminUsers() {
  const { t, date } = useI18n();
  const { values, page, update } = useUrlFilters(['q', 'role', 'status'] as const);
  const [search, setSearch] = useState(values.q);
  const debounced = useDebounced(search);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  useEffect(() => {
    if (debounced !== values.q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  const q = useQuery({
    queryKey: ['admin', 'users', values.q, values.role, values.status, page],
    queryFn: () =>
      adminApi.users({
        q: values.q || undefined,
        role: (values.role || undefined) as Role | undefined,
        status: (values.status || undefined) as UserStatus | undefined,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader
        title={t('admin.usersTitle')}
        actions={
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden />
            {t('admin.createUser')}
          </Button>
        }
      />
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-5 grid gap-3 rounded-(--radius-panel) border border-line bg-surface p-4 md:grid-cols-3"
      >
        <Input
          label={t('catalog.search')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          placeholder={t('admin.searchUsers')}
        />
        <Select
          label={t('admin.roles')}
          value={values.role}
          onChange={(e) => update({ role: e.target.value })}
        >
          <option value="">{t('catalog.all')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
        <Select
          label={t('table.status')}
          value={values.status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">{t('catalog.all')}</option>
          <option value="ACTIVE">{t('userStatus.ACTIVE')}</option>
          <option value="SUSPENDED">{t('userStatus.SUSPENDED')}</option>
        </Select>
      </form>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={t('admin.noUsers')} />
      ) : (
        <>
          <DataTable
            caption={t('admin.usersTitle')}
            rows={q.data.items}
            rowKey={(r) => r.id}
            columns={[
              { key: 'n', header: t('table.name'), primary: true, cell: (r) => r.fullName },
              {
                key: 'e',
                header: t('auth.email'),
                cell: (r) => <span className="ltr-isolate">{r.email}</span>,
              },
              {
                key: 'r',
                header: t('admin.roles'),
                cell: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.roles.map((x) => (
                      <Badge key={x} tone="info">
                        {t(`role.${x}`)}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              {
                key: 's',
                header: t('table.status'),
                cell: (r) => (
                  <Badge tone={r.status === 'ACTIVE' ? 'success' : 'danger'}>
                    {t(`userStatus.${r.status}`)}
                  </Badge>
                ),
              },
              { key: 'l', header: t('admin.lastLogin'), cell: (r) => date(r.lastLoginAt, true) },
              {
                key: 'a',
                header: '',
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={t('common.editNamed', { name: r.fullName })}
                    onClick={() => setEditing(r)}
                  >
                    <Pencil className="size-4" aria-hidden />
                    {t('common.edit')}
                  </Button>
                ),
              },
            ]}
          />
          <Pagination meta={q.data.meta} onPage={(p) => update({ page: p })} />
        </>
      )}
      <CreateDialog open={creating} onClose={() => setCreating(false)} />
      <EditDialog key={editing?.id ?? 'none'} user={editing} onClose={() => setEditing(null)} />
    </>
  );
}
