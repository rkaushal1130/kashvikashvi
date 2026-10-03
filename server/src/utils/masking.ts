/**
 * Sensitive Data Masking Utility
 * Protects PII, Banking Credentials, Tax Identifiers (PAN), and KYC artifacts
 */

export function maskBankAccount(accountNumber?: string | null): string {
  if (!accountNumber) return 'Not Provided';
  const clean = accountNumber.replace(/\s+/g, '');
  if (clean.length <= 4) return 'XXXX';
  const lastFour = clean.slice(-4);
  return `XXXX-XXXX-${lastFour}`;
}

export function maskPan(panNumber?: string | null): string {
  if (!panNumber) return 'Not Provided';
  const clean = panNumber.trim().toUpperCase();
  if (clean.length < 5) return 'XXXXX';
  const lastFour = clean.slice(-4);
  return `XXXXX${lastFour}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return 'Not Provided';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length <= 4) return '*****';
  const lastFour = clean.slice(-4);
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) : '';
  return `${prefix} *****${lastFour}`;
}

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '*****@***.***';
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `*@${domain}`;
  }
  const first = localPart[0];
  const last = localPart[localPart.length - 1];
  return `${first}****${last}@${domain}`;
}

/**
 * Strips or masks confidential fields on distributor/user profile output
 * unless the viewer is the verified owner or an administrator.
 */
export function sanitizeProfileOutput(
  profile: any,
  isPrivileged: boolean = false
): any {
  if (!profile) return null;
  const clone = { ...profile };

  if (!isPrivileged) {
    if (clone.bank_account_number) clone.bank_account_number = maskBankAccount(clone.bank_account_number);
    if (clone.bankAccountNumber) clone.bankAccountNumber = maskBankAccount(clone.bankAccountNumber);
    if (clone.pan_number) clone.pan_number = maskPan(clone.pan_number);
    if (clone.panNumber) clone.panNumber = maskPan(clone.panNumber);
    if (clone.phone) clone.phone = maskPhone(clone.phone);
    if (clone.email) clone.email = maskEmail(clone.email);

    // Completely redact raw KYC documents from non-privileged responses
    delete clone.kycDocuments;
    delete clone.panCardUrl;
    delete clone.aadhaarCardUrl;
    delete clone.bankPassbookUrl;
  }

  // Passwords and hashes are NEVER exposed to anyone under any circumstances
  delete clone.password;
  delete clone.password_hash;
  delete clone.passwordHash;

  return clone;
}
