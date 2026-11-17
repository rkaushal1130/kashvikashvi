/**
 * Official MSG91 OTP Web SDK Integration Service
 * Widget: SecureOTPWidget4R29
 * Mode: Custom UI (Headless) with exposeMethods: true
 * Official Documentation: https://docs.msg91.com
 *
 * Exposed SDK Methods on window:
 * 1. window.sendOtp(identifier, success, failure)
 * 2. window.retryOtp(channel, success, failure, reqId)
 * 3. window.verifyOtp(otp, success, failure, reqId)
 * 4. window.getWidgetData()
 * 5. window.isCaptchaVerified()
 *
 * Config:
 * - SMS Channel Identifier: '11'
 * - Country Code: 91 without '+'
 * - OTP Length: 4 digits
 * - Resend Interval: 10 seconds
 * - Session Validity: 15 minutes
 */

// Determine environment
export const isProduction = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
);

let sdkPromise = null;
let lastReqId = null;
let lastVerifiedAccessToken = null;

/**
 * Normalizes Indian phone number to 10 digits
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Validates 10-digit Indian mobile number (starts with 6, 7, 8, or 9)
 */
export function isValidIndianMobile(phone) {
  const normalized = normalizePhoneNumber(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Extracts the access token string from MSG91 SDK response
 */
export function extractAccessToken(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return (
    data['access-token'] ||
    data.accessToken ||
    data.token ||
    data.jwt ||
    data.message ||
    null
  );
}

/**
 * Extracts request ID (reqId) from MSG91 sendOtp / retryOtp response
 */
export function extractReqId(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return data.reqId || data.request_id || data.message || null;
}

/**
 * Getter for current request ID
 */
export function getLastReqId() {
  return lastReqId;
}

/**
 * Getter for last verified access token
 */
export function getLastVerifiedAccessToken() {
  return lastVerifiedAccessToken;
}

/**
 * Returns current widget data from MSG91 SDK (Method 4: window.getWidgetData())
 */
export function getWidgetData() {
  if (typeof window !== 'undefined' && typeof window.getWidgetData === 'function') {
    try {
      return window.getWidgetData();
    } catch (err) {
      console.warn('[MSG91] getWidgetData call failed:', err);
    }
  }
  return null;
}

/**
 * Checks whether anti-spam CAPTCHA has been verified (Method 5: window.isCaptchaVerified())
 * Returns true if verified, or true if captcha is not configured/required by the widget
 */
export function isCaptchaVerified() {
  if (typeof window !== 'undefined' && typeof window.isCaptchaVerified === 'function') {
    try {
      return Boolean(window.isCaptchaVerified());
    } catch (err) {
      console.warn('[MSG91] isCaptchaVerified check failed:', err);
      return false;
    }
  }
  return true;
}

/**
 * Loads the official MSG91 OTP Widget SDK script (https://verify.msg91.com/otp-provider.js)
 */
export function loadMsg91Sdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window object is not available'));
  }

  // If in node environment without DOM
  if (typeof document === 'undefined') {
    return Promise.resolve(window.initSendOTP || null);
  }

  // Already loaded and ready
  if (typeof window.initSendOTP === 'function') {
    return Promise.resolve(window.initSendOTP);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    // Check if script element already exists in document
    const existing = document.querySelector('script[src*="otp-provider.js"]');
    if (existing) {
      if (typeof window.initSendOTP === 'function') {
        resolve(window.initSendOTP);
      } else {
        existing.addEventListener('load', () => resolve(window.initSendOTP));
        existing.addEventListener('error', () => {
          sdkPromise = null;
          if (isProduction) {
            reject(new Error('Failed to load MSG91 OTP Provider script in production.'));
          } else {
            console.warn('[MSG91] Failed to load OTP script. Local mock fallback active for development.');
            resolve(null);
          }
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://verify.msg91.com/otp-provider.js';
    script.type = 'text/javascript';
    script.async = true;

    script.onload = () => {
      resolve(window.initSendOTP);
    };

    script.onerror = () => {
      sdkPromise = null;
      if (isProduction) {
        reject(
          new Error(
            'Failed to load MSG91 OTP script from verify.msg91.com in production. Please check network/ad-blocker settings.'
          )
        );
      } else {
        console.warn(
          '⚠️ Could not load MSG91 SDK script from verify.msg91.com. Local mock fallback enabled for development.'
        );
        resolve(null);
      }
    };

    document.head.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Initializes the MSG91 OTP widget configuration
 * - Widget: SecureOTPWidget4R29
 * - exposeMethods: true (Required for Custom UI)
 */
export async function initMsg91Widget({ onSuccess, onFailure, captchaRenderId = 'msg91-captcha-container' } = {}) {
  const widgetId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MSG91_WIDGET_ID) ||
    'SecureOTPWidget4R29';
  const tokenAuth =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MSG91_TOKEN_AUTH) ||
    '';

  const initSendOTP = await loadMsg91Sdk();

  // MSG91 Official Configuration Object
  window.configuration = {
    widgetId,
    tokenAuth,
    exposeMethods: true, // EXPOSES: window.sendOtp, window.retryOtp, window.verifyOtp, window.getWidgetData, window.isCaptchaVerified
    captchaRenderId: captchaRenderId || 'msg91-captcha-container', // Unique HTML element ID for CAPTCHA rendering
    success: (data) => {
      const token = extractAccessToken(data);
      if (token) {
        lastVerifiedAccessToken = token;
      }
      if (typeof onSuccess === 'function') {
        onSuccess(data, token);
      }
    },
    failure: (error) => {
      console.error('[MSG91] Verification failure callback:', error);
      if (typeof onFailure === 'function') {
        onFailure(error);
      }
    },
  };

  if (typeof window.initSendOTP === 'function') {
    try {
      window.initSendOTP(window.configuration);
      return true;
    } catch (err) {
      console.warn('[MSG91] initSendOTP invocation warning:', err);
      return false;
    }
  }

  return false;
}

/**
 * STEP 1: Send OTP to 10-digit Indian Mobile
 * Method: window.sendOtp(identifier, success, failure)
 * Identifier format: 91 + 10-digit mobile (no '+') e.g. '919876543210'
 */
export async function sendOtpToMobile(phone) {
  const normalized = normalizePhoneNumber(phone);
  if (!isValidIndianMobile(normalized)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number.');
  }

  // MSG91 requires country code without '+': '919876543210'
  const identifier = `91${normalized}`;

  // Ensure widget is initialized
  await initMsg91Widget();

  // If the widget SDK methods are still attaching, wait briefly (up to 1500ms) rather than failing immediately
  if (typeof window !== 'undefined' && typeof window.sendOtp !== 'function') {
    const start = Date.now();
    while (Date.now() - start < 1500) {
      if (typeof window.sendOtp === 'function') break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // CAPTCHA verification check if enforced by widget
  if (typeof window !== 'undefined' && typeof window.isCaptchaVerified === 'function') {
    if (!window.isCaptchaVerified()) {
      throw new Error('Please complete the CAPTCHA verification above before sending OTP.');
    }
  }

  // Official MSG91 Method 1: window.sendOtp(identifier, success, failure)
  if (typeof window !== 'undefined' && typeof window.sendOtp === 'function') {
    return new Promise((resolve, reject) => {
      const handleSuccess = (res) => {
        const reqId = extractReqId(res);
        if (reqId) {
          lastReqId = reqId;
        }
        resolve({
          type: 'success',
          response: res,
          reqId: reqId || lastReqId,
          message: 'OTP sent successfully to your mobile number.',
        });
      };

      const handleFailure = (err) => {
        const errMsg =
          err?.message ||
          (typeof err === 'string' ? err : null) ||
          'Failed to send OTP via MSG91.';
        reject(new Error(errMsg));
      };

      try {
        window.sendOtp(identifier, handleSuccess, handleFailure);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Production check: mock OTP is strictly disabled in production
  if (isProduction) {
    throw new Error(
      'MSG91 OTP service is currently unavailable. Mock OTP is strictly disabled in production.'
    );
  }

  // Fallback for local development / testing ONLY
  const mockReqId = `mock-req-91${normalized}-${Date.now()}`;
  lastReqId = mockReqId;
  console.log(
    `[MSG91-DEV-MOCK] Simulated OTP sent to +91 ${normalized}. Enter 1234 to verify. (Mock reqId: ${mockReqId})`
  );
  return {
    type: 'success',
    reqId: mockReqId,
    message: 'OTP sent successfully (Dev Mock Mode). Use 1234 to verify.',
  };
}

/**
 * STEP 2: Resend / Retry OTP
 * Method: window.retryOtp(channel, success, failure, reqId)
 * Channel: '11' for SMS
 */
export async function resendOtp(channel = '11') {
  const retryChannel = channel || '11';

  // Official MSG91 Method 2: window.retryOtp(channel, success, failure, reqId)
  if (typeof window !== 'undefined' && typeof window.retryOtp === 'function') {
    return new Promise((resolve, reject) => {
      const handleSuccess = (res) => {
        const reqId = extractReqId(res);
        if (reqId) {
          lastReqId = reqId;
        }
        resolve({
          type: 'success',
          response: res,
          reqId: reqId || lastReqId,
          message: 'OTP resent successfully.',
        });
      };

      const handleFailure = (err) => {
        const errMsg =
          err?.message ||
          (typeof err === 'string' ? err : null) ||
          'Failed to resend OTP via MSG91.';
        reject(new Error(errMsg));
      };

      try {
        window.retryOtp(retryChannel, handleSuccess, handleFailure, lastReqId || undefined);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Production check: mock OTP is strictly disabled in production
  if (isProduction) {
    throw new Error(
      'MSG91 OTP service is currently unavailable. Mock OTP is strictly disabled in production.'
    );
  }

  console.log('[MSG91-DEV-MOCK] Simulated OTP resent. Enter 1234 to verify.');
  return {
    type: 'success',
    reqId: lastReqId,
    message: 'OTP resent successfully.',
  };
}

/**
 * STEP 3: Verify OTP Code
 * Method: window.verifyOtp(otp, success, failure, reqId)
 * Captures access token returned by MSG91 upon success
 */
export async function verifyOtpCode(otp, phone) {
  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp || cleanOtp.length !== 4) {
    throw new Error('Please enter a valid 4-digit OTP.');
  }

  const normalizedPhone = normalizePhoneNumber(phone);

  // Official MSG91 Method 3: window.verifyOtp(otp, success, failure, reqId)
  if (typeof window !== 'undefined' && typeof window.verifyOtp === 'function') {
    return new Promise((resolve, reject) => {
      const handleSuccess = (res) => {
        const token = extractAccessToken(res) || lastVerifiedAccessToken;
        if (token) {
          lastVerifiedAccessToken = token;
        }
        resolve({
          response: res,
          accessToken: token,
        });
      };

      const handleFailure = (err) => {
        const errMsg =
          err?.message ||
          (typeof err === 'string' ? err : null) ||
          'Invalid OTP. Please check and try again.';
        reject(new Error(errMsg));
      };

      try {
        window.verifyOtp(cleanOtp, handleSuccess, handleFailure, lastReqId || undefined);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Production check: mock OTP is strictly disabled in production
  if (isProduction) {
    throw new Error(
      'MSG91 OTP service is currently unavailable. Mock OTP is strictly disabled in production.'
    );
  }

  // Local development / mock mode (only in non-production)
  if (cleanOtp === '1234') {
    const mockAccessToken = `mock-access-token-91${normalizedPhone}-${Date.now()}`;
    lastVerifiedAccessToken = mockAccessToken;
    return {
      response: { type: 'success', message: 'Verified' },
      accessToken: mockAccessToken,
    };
  }

  throw new Error('Incorrect OTP. Please enter the 4-digit OTP sent to your phone.');
}
