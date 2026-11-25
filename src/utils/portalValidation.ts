export const INSTITUTE_ID = 'IEM_PORTAL' as const;
export const BOOTSTRAP_ADMIN_EMAIL = 'sahakamolendu@gmail.com';
export const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && VALID_DOC_ID_REGEX.test(id);
}

export function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase().slice(0, 160);
}

export function sanitizeSlugId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  if (cleaned.length >= 2 && cleaned.length <= 128) return cleaned;
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
}
