import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  UserCircle,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MessageKey } from '@/i18n/messages/ar';
import type { Role, User } from '@/lib/api/types';
import { hasRole } from '@/lib/roles';

export interface NavItem {
  href: string;
  label: MessageKey;
  icon: LucideIcon;
  /** exact match only (so /admin does not stay active on /admin/users) */
  exact?: boolean;
}
export interface NavSection {
  title: MessageKey;
  items: NavItem[];
}

const SECTIONS: { role: Role; section: NavSection }[] = [
  {
    role: 'STUDENT',
    section: {
      title: 'nav.studentArea',
      items: [
        { href: '/student', label: 'nav.myDashboard', icon: LayoutDashboard, exact: true },
        { href: '/courses', label: 'nav.courses', icon: Library },
      ],
    },
  },
  {
    role: 'INSTRUCTOR',
    section: {
      title: 'nav.instructorArea',
      items: [
        { href: '/instructor', label: 'nav.myCourses', icon: GraduationCap, exact: true },
        { href: '/instructor/courses/new', label: 'nav.newCourse', icon: PlusCircle },
      ],
    },
  },
  {
    role: 'ADMIN',
    section: {
      title: 'nav.adminArea',
      items: [
        { href: '/admin', label: 'nav.overview', icon: ShieldCheck, exact: true },
        { href: '/admin/users', label: 'nav.users', icon: Users },
        { href: '/admin/courses', label: 'nav.allCourses', icon: BookOpen },
        { href: '/admin/audit', label: 'nav.audit', icon: ScrollText },
      ],
    },
  },
];

export function navFor(user: Pick<User, 'roles'>): NavSection[] {
  const sections = SECTIONS.filter((s) => hasRole(user, s.role)).map((s) => s.section);
  // Staff also browse the public catalogue.
  if (!hasRole(user, 'STUDENT')) {
    const first = sections[0];
    if (first && !first.items.some((i) => i.href === '/courses'))
      sections.push({
        title: 'nav.explore',
        items: [{ href: '/courses', label: 'nav.courses', icon: Library }],
      });
  }
  sections.push({
    title: 'nav.account',
    items: [{ href: '/profile', label: 'nav.profile', icon: UserCircle }],
  });
  return sections;
}
