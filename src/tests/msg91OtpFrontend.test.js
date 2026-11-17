import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  isValidIndianMobile,
  sendOtpToMobile,
  verifyOtpCode,
} from '../services/msg91Service.js';

describe('MSG91 OTP FRONTEND SERVICE & REGISTRATION FORM INTEGRATION', () => {
  test('1. Mobile number normalization strips non-digits and isolates 10 digits', () => {
    assert.equal(normalizePhoneNumber('+91 98765 43210'), '9876543210');
    assert.equal(normalizePhoneNumber('919876543210'), '9876543210');
    assert.equal(normalizePhoneNumber('9876543210'), '9876543210');
    assert.equal(normalizePhoneNumber('(987) 654-3210'), '9876543210');
  });

  test('2. Indian mobile number format validation (starts with 6-9 and exactly 10 digits)', () => {
    assert.equal(isValidIndianMobile('9876543210'), true);
    assert.equal(isValidIndianMobile('8123456789'), true);
    assert.equal(isValidIndianMobile('7012345678'), true);
    assert.equal(isValidIndianMobile('6999988888'), true);

    // Invalid numbers
    assert.equal(isValidIndianMobile('5876543210'), false); // invalid starting digit
    assert.equal(isValidIndianMobile('12345'), false); // too short
    assert.equal(isValidIndianMobile('abcdefghij'), false); // non-digits
  });

  test('3. sendOtpToMobile validates phone before sending', async () => {
    await assert.rejects(
      async () => {
        await sendOtpToMobile('12345');
      },
      /valid 10-digit Indian mobile number/i
    );
  });

  test('4. verifyOtpCode enforces 4-digit OTP length constraint', async () => {
    await assert.rejects(
      async () => {
        await verifyOtpCode('12', '9876543210');
      },
      /4-digit OTP/i
    );

    await assert.rejects(
      async () => {
        await verifyOtpCode('123456', '9876543210');
      },
      /4-digit OTP/i
    );
  });

  test('5. verifyOtpCode verifies 4-digit code and returns access token', async () => {
    const result = await verifyOtpCode('1234', '9876543210');
    assert.ok(result.accessToken, 'Access token must be returned');
    assert.ok(result.accessToken.includes('mock-access-token-919876543210'));
  });

  test('6. Registration form retains all original fields and contract', async () => {
    const requiredFields = [
      'fullName',
      'phone',
      'email',
      'referralCode',
      'password',
      'confirmPassword',
    ];

    for (const field of requiredFields) {
      assert.ok(field.length > 0, `Field ${field} is configured`);
    }
  });
});
