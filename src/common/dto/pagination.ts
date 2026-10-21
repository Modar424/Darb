import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;

export class PageQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page: number = 1;

  /** Items per page (max 100). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;

  /** Sort as `field:asc|desc`. Only allowlisted fields are accepted per endpoint. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sort?: string;
}

export class PageResult<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: { page: number; pageSize: number; total: number; totalPages: number },
  ) {}

  static of<T>(items: T[], total: number, q: { page: number; pageSize: number }): PageResult<T> {
    return new PageResult(items, {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    });
  }
}

export const skipTake = (q: { page: number; pageSize: number }) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

/** Parses `field:dir` against an allowlist and maps to a safe column expression. */
export function parseSort(
  sort: string | undefined,
  allowed: Record<string, string>,
  fallback: { field: string; dir: 'ASC' | 'DESC' },
): { column: string; dir: 'ASC' | 'DESC' } {
  const field = sort ? sort.split(':')[0] : fallback.field;
  const rawDir = sort ? (sort.split(':')[1] ?? 'asc') : fallback.dir;
  const dir = rawDir.toUpperCase();
  if (!(field in allowed) || (dir !== 'ASC' && dir !== 'DESC')) {
    throw new BadRequestException(
      `Invalid sort. Allowed fields: ${Object.keys(allowed).join(', ')}`,
    );
  }
  return { column: allowed[field], dir };
}

/** Escapes LIKE wildcards in user-provided search terms. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
