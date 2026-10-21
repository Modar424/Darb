import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderApp } from '@/test/utils';
import { Button } from './button';
import { Input } from './field';
import { Pagination } from './pagination';
import { Tabs } from './tabs';
import { DataTable } from './data-table';
import { Dialog } from './dialog';
import { Alert, ProgressBar } from './primitives';

describe('Button', () => {
  it('is disabled and busy while loading, preventing double submit', async () => {
    const onClick = vi.fn();
    renderApp(
      <Button loading onClick={onClick}>
        حفظ
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'حفظ' });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('defaults to type=button so it never submits a form by accident', () => {
    renderApp(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});

describe('Input', () => {
  it('links label, hint and error for assistive tech', () => {
    renderApp(<Input label="البريد" error="مطلوب" required />);
    const input = screen.getByLabelText(/البريد/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const err = screen.getByRole('alert');
    expect(err).toHaveTextContent('مطلوب');
    expect(input.getAttribute('aria-describedby')).toContain(err.id);
  });
  it('shows the hint only when there is no error', () => {
    const { rerender } = renderApp(<Input label="x" hint="تلميح" />);
    expect(screen.getByText('تلميح')).toBeInTheDocument();
    rerender(<Input label="x" hint="تلميح" error="خطأ" />);
    expect(screen.queryByText('تلميح')).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = renderApp(
      <Pagination meta={{ page: 1, pageSize: 10, total: 3, totalPages: 1 }} onPage={() => {}} />,
    );
    expect(container.querySelector('nav')).toBeNull();
  });
  it('disables edges and navigates', async () => {
    const onPage = vi.fn();
    renderApp(
      <Pagination meta={{ page: 1, pageSize: 10, total: 25, totalPages: 3 }} onPage={onPage} />,
      { locale: 'en' },
    );
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(onPage).toHaveBeenCalledWith(2);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });
});

function TabsHarness() {
  const [v, setV] = useState('a');
  return (
    <Tabs
      label="أقسام"
      value={v}
      onChange={setV}
      items={[
        { id: 'a', label: 'أ', content: 'محتوى أ' },
        { id: 'b', label: 'ب', content: 'محتوى ب' },
        { id: 'c', label: 'ج', content: 'محتوى ج' },
      ]}
    />
  );
}
describe('Tabs', () => {
  it('uses roving tabindex and shows only the selected panel', async () => {
    renderApp(<TabsHarness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(screen.getByText('محتوى أ')).toBeVisible();
    expect(screen.queryByText('محتوى ب')).not.toBeInTheDocument();
  });
  it('moves with arrow keys, following the document direction', async () => {
    document.documentElement.dir = 'ltr';
    renderApp(<TabsHarness />);
    const first = screen.getAllByRole('tab')[0] as HTMLElement;
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('DataTable', () => {
  const rows = [{ id: '1', name: 'سارة', role: 'طالب' }];
  it('renders both the table and the stacked list with labelled values', () => {
    renderApp(
      <DataTable
        caption="المستخدمون"
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: 'n', header: 'الاسم', primary: true, cell: (r) => r.name },
          { key: 'r', header: 'الدور', cell: (r) => r.role },
        ]}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'الاسم',
      'الدور',
    ]);
    const list = screen.getByRole('list', { name: 'المستخدمون' });
    expect(within(list).getByText('الدور')).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  it('opens, labels itself, and closes via the close button', async () => {
    const onClose = vi.fn();
    renderApp(
      <Dialog open onClose={onClose} title="عنوان" description="وصف">
        <p>جسم</p>
      </Dialog>,
    );
    const dlg = document.querySelector('dialog') as HTMLDialogElement;
    expect(dlg).toHaveAttribute('open');
    expect(dlg).toHaveAttribute('aria-labelledby', 'dlg-title');
    expect(screen.getByText('عنوان')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalled();
  });
  it('does not close when not dismissible', async () => {
    const onClose = vi.fn();
    renderApp(<Dialog open onClose={onClose} title="t" dismissible={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('feedback primitives', () => {
  it('Alert uses alert role only when live', () => {
    const { rerender } = renderApp(
      <Alert tone="danger" live>
        خطأ
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('خطأ');
    rerender(<Alert>معلومة</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('معلومة');
  });
  it('ProgressBar clamps and exposes aria values', () => {
    renderApp(<ProgressBar value={140} label="التقدّم" />);
    expect(screen.getByRole('progressbar', { name: 'التقدّم' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });
});
