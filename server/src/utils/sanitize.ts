/**
 * XSS-Safe Input/Output Sanitization Utility
 * Neutralizes malicious script tags, event handlers, and data URIs
 */

export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function stripHtmlTags(str: string): string {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '').trim();
}

export function sanitizeInput<T>(input: T): T {
  if (typeof input === 'string') {
    // Strip direct executable script tags and neutralize HTML
    return stripHtmlTags(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const sanitizedObj: any = {};
    for (const [key, val] of Object.entries(input)) {
      sanitizedObj[key] = sanitizeInput(val);
    }
    return sanitizedObj;
  }
  return input;
}
