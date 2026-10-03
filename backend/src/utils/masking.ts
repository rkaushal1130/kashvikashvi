/**
 * Utilities for masking sensitive PII and financial information.
 */

export function maskAccountNumber(accountNumber: string | null | undefined): string {
  if (!accountNumber) return '';
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  const visibleLength = 4;
  const maskedLength = trimmed.length - visibleLength;
  return `${'*'.repeat(Math.min(maskedLength, 12))}${trimmed.slice(-visibleLength)}`;
}

export function maskIfsc(ifsc: string | null | undefined): string {
  if (!ifsc) return '';
  const trimmed = ifsc.trim().toUpperCase();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(trimmed.length - 6, 2))}${trimmed.slice(-2)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain || localPart.length <= 2) {
    return `${localPart?.[0] || '*'}***@${domain || '***'}`;
  }
  return `${localPart[0]}${'*'.repeat(Math.max(localPart.length - 2, 2))}${localPart.slice(-1)}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return '****';
  }
  return `${'*'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

/**
 * Sanitizes an Enrollment entity and its steps for safe client response.
 * Strips password hashes, raw PINs, and masks banking details.
 */
export function sanitizeEnrollmentResponse(enrollment: any): any {
  if (!enrollment) return null;

  const sanitized = { ...enrollment };

  // Strip security hash
  delete sanitized.securityPinHash;

  // Sanitize steps
  if (Array.isArray(sanitized.steps)) {
    sanitized.steps = sanitized.steps.map((step: any) => {
      if (step.stepNumber === 5 && step.stepData) {
        const stepData = { ...step.stepData };
        // Never return plain PIN or hash
        delete stepData.securityPin;
        delete stepData.securityPinHash;
        stepData.pinConfigured = Boolean(step.stepData.securityPin || step.stepData.securityPinHash || enrollment.securityPinHash);

        if (stepData.accountNumber) {
          stepData.accountNumber = maskAccountNumber(stepData.accountNumber);
        }
        if (stepData.ifsc) {
          stepData.ifsc = maskIfsc(stepData.ifsc);
        }
        return {
          ...step,
          stepData,
        };
      }
      return step;
    });
  }

  return sanitized;
}
