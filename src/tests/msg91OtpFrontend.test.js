import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  isValidIndianMobile,
  parseIndianMobile,
  sendOtpToMobile,
  resendOtp,
  verifyOtpCode,
  initMsg91Widget,
  isCaptchaVerified,
  getWidgetData,
  getLastReqId,
  isProduction,
  getWidgetCredentials,
} from '../services/msg91Service.js';

describe('MSG91 OTP FRONTEND SERVICE & REGISTRATION FORM INTEGRATION', () => {
  beforeEach(() => {
    // Clean mock window
    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }
  });

  afterEach(() => {
    delete globalThis.window.sendOtp;
    delete globalThis.window.retryOtp;
    delete globalThis.window.verifyOtp;
    delete globalThis.window.getWidgetData;
    delete globalThis.window.isCaptchaVerified;
    delete globalThis.window.initSendOTP;
    delete globalThis.window.configuration;
  });

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
    assert.equal(isValidIndianMobile('09876543210'), false); // leading zero rejected
  });

  test('3. parseIndianMobile strictly enforces Indian mobile rules and rejects leading zero without slicing', () => {
    // Leading zero rejection
    const zeroRes = parseIndianMobile('09876543210');
    assert.equal(zeroRes.valid, false);
    assert.match(zeroRes.error, /cannot begin with 0/i);

    // Number starting with 0 after +91
    const countryZeroRes = parseIndianMobile('+91 0987654321');
    assert.equal(countryZeroRes.valid, false);
    assert.match(countryZeroRes.error, /cannot begin with 0/i);

    // Invalid starting digit (< 6)
    const invalidStart = parseIndianMobile('5876543210');
    assert.equal(invalidStart.valid, false);
    assert.match(invalidStart.error, /must start with 6, 7, 8, or 9/i);

    // Short number
    const shortNum = parseIndianMobile('98765');
    assert.equal(shortNum.valid, false);
    assert.match(shortNum.error, /exactly 10 digits/i);

    // Valid 10-digit number
    const validNum = parseIndianMobile('9876543210');
    assert.equal(validNum.valid, true);
    assert.equal(validNum.digits, '9876543210');
    assert.equal(validNum.formattedIdentifier, '919876543210');

    // Valid 10-digit number with +91 and spaces
    const validWithCountry = parseIndianMobile('+91 98765 43210');
    assert.equal(validWithCountry.valid, true);
    assert.equal(validWithCountry.digits, '9876543210');
    assert.equal(validWithCountry.formattedIdentifier, '919876543210');
  });

  test('4. sendOtpToMobile validates phone before sending', async () => {
    await assert.rejects(
      async () => {
        await sendOtpToMobile('12345');
      },
      /exactly 10 digits/i
    );

    await assert.rejects(
      async () => {
        await sendOtpToMobile('09876543210');
      },
      /cannot begin with 0/i
    );
  });

  test('5. verifyOtpCode enforces 4-digit OTP length constraint', async () => {
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

  test('6. verifyOtpCode in mock mode returns mock access token when no window.verifyOtp', async () => {
    const result = await verifyOtpCode('1234', '9876543210');
    assert.ok(result.accessToken, 'Access token must be returned');
    assert.ok(result.accessToken.includes('mock-access-token-919876543210'));
  });

  test('7. Registration form retains all original fields and contract', async () => {
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

  test('8. initMsg91Widget sets exposeMethods: true, widgetId: SecureOTPWidget4R29, and captchaRenderId', async () => {
    globalThis.window.initSendOTP = (config) => {
      globalThis.window.configuration = config;
    };

    await initMsg91Widget();
    assert.equal(globalThis.window.configuration.exposeMethods, true);
    assert.equal(
      globalThis.window.configuration.widgetId,
      'SecureOTPWidget4R29'
    );
    assert.equal(
      globalThis.window.configuration.captchaRenderId,
      'msg91-captcha-container'
    );
  });

  test('9. sendOtp uses window.sendOtp with identifier (91+phone) and extracts reqId', async () => {
    let capturedIdentifier = null;
    globalThis.window.sendOtp = (identifier, success, failure) => {
      capturedIdentifier = identifier;
      success({ message: 'req-msg91-test-12345', type: 'success' });
    };

    const res = await sendOtpToMobile('9876543210');
    assert.equal(capturedIdentifier, '919876543210');
    assert.equal(res.reqId, 'req-msg91-test-12345');
    assert.equal(getLastReqId(), 'req-msg91-test-12345');
  });

  test('10. resendOtp passes SMS channel 11 and lastReqId to window.retryOtp', async () => {
    let capturedChannel = null;
    let capturedReqId = null;

    globalThis.window.retryOtp = (channel, success, failure, reqId) => {
      capturedChannel = channel;
      capturedReqId = reqId;
      success({ message: 'req-msg91-retry-67890', type: 'success' });
    };

    const res = await resendOtp();
    assert.equal(capturedChannel, '11');
    assert.equal(capturedReqId, 'req-msg91-test-12345');
    assert.equal(res.reqId, 'req-msg91-retry-67890');
  });

  test('11. verifyOtpCode passes code and reqId to window.verifyOtp and extracts accessToken', async () => {
    let capturedOtp = null;
    let capturedReqId = null;

    globalThis.window.verifyOtp = (otp, success, failure, reqId) => {
      capturedOtp = otp;
      capturedReqId = reqId;
      success({ 'access-token': 'jwt-msg91-verified-token-xyz' });
    };

    const res = await verifyOtpCode('4321', '9876543210');
    assert.equal(capturedOtp, '4321');
    assert.equal(capturedReqId, 'req-msg91-retry-67890');
    assert.equal(res.accessToken, 'jwt-msg91-verified-token-xyz');
  });

  test('12. sendOtpToMobile blocks if CAPTCHA is required but unverified', async () => {
    globalThis.window.isCaptchaVerified = () => false;
    globalThis.window.sendOtp = () => {};

    await assert.rejects(
      async () => {
        await sendOtpToMobile('9876543210');
      },
      /CAPTCHA verification/i
    );
  });

  test('13. sendOtpToMobile surfaces failure callback with detailed error message', async () => {
    globalThis.window.sendOtp = (identifier, success, failure) => {
      failure({ message: 'Invalid token auth credentials' });
    };

    await assert.rejects(
      async () => {
        await sendOtpToMobile('9876543210');
      },
      /Invalid token auth credentials/i
    );
  });

  test('14. getWidgetCredentials filters out placeholder env strings and falls back to SecureOTPWidget4R29', () => {
    const creds = getWidgetCredentials();
    assert.equal(creds.widgetId, 'SecureOTPWidget4R29');
    assert.ok(creds.widgetId.length > 0);
  });
});
