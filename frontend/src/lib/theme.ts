export const THEME_COOKIE = 'lms_theme';
export type Theme = 'light' | 'dark';
export const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark';
