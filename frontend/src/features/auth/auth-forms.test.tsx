import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@/lib/api/client';
import { renderApp, routerMock, setSearchParams } from '@/test/utils';
import { ForgotForm, LoginForm, RegisterForm, ResetForm } from './auth-forms';

const login = vi.fn();
const signUp = vi.fn();
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ login, register: signUp, user: null, status: 'anonymous' }),
}));
const forgot = vi.fn();
const reset = vi.fn();
vi.mock('@/lib/api/endpoints', () => ({
  authApi: { forgot: (...a: unknown[]) => forgot(...a), reset: (...a: unknown[]) => reset(...a) },
}));

beforeEach(() => {
  login.mockReset();
  signUp.mockReset();
  forgot.mockReset();
  reset.mockReset();
  routerMock.replace.mockReset();
  setSearchParams('');
});

describe('LoginForm', () => {
  it('shows required-field errors without calling the API', async () => {
    renderApp(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(login).not.toHaveBeenCalled();
  });
  it('logs in and redirects to the role home', async () => {
    login.mockResolvedValue({ roles: ['INSTRUCTOR'] });
    renderApp(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'secret-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/instructor'));
    expect(login).toHaveBeenCalledWith('a@b.co', 'secret-pass-1');
  });
  it('honours a safe ?next and ignores an external one', async () => {
    login.mockResolvedValue({ roles: ['STUDENT'] });
    setSearchParams('next=%2Flearn%2F42');
    const { unmount } = renderApp(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/learn/42'));
    unmount();
    routerMock.replace.mockReset();
    setSearchParams('next=https%3A%2F%2Fevil.example');
    renderApp(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/student'));
  });
  it('shows a localised generic message for bad credentials', async () => {
    login.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderApp(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(
      await screen.findByText('البريد الإلكتروني أو كلمة المرور غير صحيحة.'),
    ).toBeInTheDocument();
  });
  it('shows the session-expired notice', () => {
    setSearchParams('expired=1');
    renderApp(<LoginForm />);
    expect(screen.getByText('انتهت جلستك، سجّل الدخول للمتابعة.')).toBeInTheDocument();
  });
});

describe('RegisterForm', () => {
  it('rejects a short password client-side', async () => {
    renderApp(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/الاسم الكامل/), 'سارة أحمد');
    await userEvent.type(screen.getByLabelText(/البريد الإلكتروني/), 'sara@example.com');
    await userEvent.type(screen.getByLabelText(/كلمة المرور/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    expect(
      await screen.findByText('يجب أن تتكوّن كلمة المرور من 10 إلى 128 حرفاً.'),
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
  it('registers with the active locale and redirects', async () => {
    signUp.mockResolvedValue({ roles: ['STUDENT'] });
    renderApp(<RegisterForm />, { locale: 'en' });
    await userEvent.type(screen.getByLabelText(/Full name/), 'Sara Ahmed');
    await userEvent.type(screen.getByLabelText(/^Email/), 'sara@example.com');
    await userEvent.type(screen.getByLabelText(/^Password/), 'a-long-secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/student'));
    expect(signUp).toHaveBeenCalledWith({
      fullName: 'Sara Ahmed',
      email: 'sara@example.com',
      password: 'a-long-secret-pass',
      locale: 'en',
    });
  });
});

describe('ForgotForm', () => {
  it('shows the same neutral confirmation after success', async () => {
    forgot.mockResolvedValue({ message: 'ok' });
    renderApp(<ForgotForm />, { locale: 'en' });
    await userEvent.type(screen.getByLabelText(/Email/), 'anyone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText(/If the email is registered/)).toBeInTheDocument();
  });
});

describe('ResetForm', () => {
  it('rejects a missing/short token without showing the form', () => {
    setSearchParams('');
    renderApp(<ResetForm />, { locale: 'en' });
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
    expect(screen.queryByLabelText(/New password/)).not.toBeInTheDocument();
  });
  it('submits the token with the new password', async () => {
    reset.mockResolvedValue({ success: true });
    setSearchParams('token=' + 'a'.repeat(40));
    renderApp(<ResetForm />, { locale: 'en' });
    await userEvent.type(screen.getByLabelText(/New password/), 'a-long-secret-pass');
    await userEvent.type(screen.getByLabelText(/Confirm password/), 'a-long-secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith({
        token: 'a'.repeat(40),
        newPassword: 'a-long-secret-pass',
      }),
    );
    expect(await screen.findByText(/password has been changed/i)).toBeInTheDocument();
  });
});
