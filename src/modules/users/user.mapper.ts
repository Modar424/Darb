import { User } from '../../database/entities';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  bio: string | null;
  locale: string;
  status: string;
  roles: string[];
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Explicit allowlist serialisation: sensitive columns can never leak through this path. */
export const toUserDto = (u: User): UserDto => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  bio: u.bio,
  locale: u.locale,
  status: u.status,
  roles: (u.roles ?? []).map((r) => r.name),
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});
