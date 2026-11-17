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

import { authApi } from '../api/authApi.js';

// Determine environment
export const isProduction = Boolean(
  (typeof import.meta !== 'undefined' && import.meta.env?.PROD) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
);

const isDev = Boolean(typeof import.meta !== 'undefined' && import.meta.env?.DEV);

function debugLog(...args) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[MSG91-SDK]', ...args);
  }
}

function debugWarn(...args) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn('[MSG91-SDK]', ...args);
  }
}

function debugError(...args) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error('[MSG91-SDK]', ...args);
  }
}

let sdkPromise = null;
let lastReqId = null;
let lastVerifiedAccessToken = null;
let lastInitError = null;
let isSendOtpInFlight = false;
const globalFailureListeners = new Set();

/**
 * Validates and parses Indian mobile number:
 * - Exactly 10 digits
 * - Starts with 6, 7, 8, or 9
 * - Rejects numbers beginning with 0 (no silent trimming)
 * - Returns formatted MSG91 identifier: 91 + 10 digits (no '+')
 */
export function parseIndianMobile(phone) {
  if (!phone) {
    return { valid: false, error: 'Mobile number is required.' };
  }
  const raw = String(phone).trim();
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, '');

  if (raw.startsWith('0') || cleaned.startsWith('0')) {
    return {
      valid: false,
      error: 'Mobile number cannot begin with 0. Please enter a valid 10-digit Indian mobile number.',
    };
  }

  let digits = cleaned;
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0')) {
    return {
      valid: false,
      error: 'Mobile number cannot begin with 0. Please enter a valid 10-digit Indian mobile number.',
    };
  }

  if (!/^\d+$/.test(digits)) {
    return {
      valid: false,
      error: 'Mobile number must contain digits only.',
    };
  }

  if (digits.length !== 10) {
    return {
      valid: false,
      error: `Mobile number must be exactly 10 digits (currently ${digits.length} digits).`,
    };
  }

  if (!/^[6-9]/.test(digits)) {
    return {
      valid: false,
      error: 'Invalid Indian mobile number. Mobile number must start with 6, 7, 8, or 9.',
    };
  }

  return {
    valid: true,
    digits,
    identifier: `91${digits}`,
    formattedIdentifier: `91${digits}`,
  };
}

/**
 * Validates 10-digit Indian mobile number format
 */
export function isValidIndianMobile(phone) {
  return parseIndianMobile(phone).valid;
}

/**
 * Normalizes Indian phone number to 10 digits (if valid)
 */
export function normalizePhoneNumber(phone) {
  const res = parseIndianMobile(phone);
  return res.valid ? res.digits : String(phone || '').replace(/[\s\-\(\)\.]/g, '');
}

/**
 * Safely extracts widget credentials, falling back from template placeholders
 */
export function getWidgetCredentials() {
  const envWidgetId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MSG91_WIDGET_ID) ||
    (typeof process !== 'undefined' && process.env?.VITE_MSG91_WIDGET_ID) ||
    '';
  const envTokenAuth =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MSG91_TOKEN_AUTH) ||
    (typeof process !== 'undefined' && process.env?.VITE_MSG91_TOKEN_AUTH) ||
    '';

  const isPlaceholder = (val) =>
    !val ||
    val.includes('your_msg91') ||
    val.includes('here') ||
    val.includes('change_this');

  const widgetId = !isPlaceholder(envWidgetId)
    ? envWidgetId.trim()
    : 'SecureOTPWidget4R29';

  const tokenAuth = !isPlaceholder(envTokenAuth)
    ? envTokenAuth.trim()
    : '585491TWZBFW9dY06afafddcP1';

  return { widgetId, tokenAuth };
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
      debugWarn('getWidgetData call failed:', err);
    }
  }
  return null;
}

/**
 * Anti-spam CAPTCHA helper (disabled - OTP sent directly without CAPTCHA)
 */
export function isCaptchaVerified() {
  return true;
}

/**
 * Loads the official MSG91 OTP Widget SDK script (https://verify.msg91.com/otp-provider.js)
 */
export function loadMsg91Sdk() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window object is not available'));
  }

  // Node/test environment guard
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
      debugLog('MSG91 SDK script loaded.');
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
        debugWarn('Could not load MSG91 SDK script. Local mock fallback enabled for development.');
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
export async function initMsg91Widget({ onSuccess, onFailure, captchaRenderId } = {}) {
  const { widgetId, tokenAuth } = getWidgetCredentials();

  debugLog('Configuring MSG91 Widget:', {
    widgetId,
    exposeMethods: true,
    hasTokenAuth: Boolean(tokenAuth),
  });

  await loadMsg91Sdk();

  // MSG91 Official Configuration Object (Direct OTP without CAPTCHA)
  window.configuration = {
    widgetId,
    tokenAuth,
    exposeMethods: true, // EXPOSES: window.sendOtp, window.retryOtp, window.verifyOtp, window.getWidgetData, window.isCaptchaVerified
    ...(captchaRenderId ? { captchaRenderId } : {}),
    success: (data) => {
      debugLog('MSG91 configuration success callback.');
      const token = extractAccessToken(data);
      if (token) {
        lastVerifiedAccessToken = token;
      }
      if (typeof onSuccess === 'function') {
        onSuccess(data, token);
      }
    },
    failure: (error) => {
      const errMsg = error?.message || (typeof error === 'string' ? error : 'MSG91 Widget Initialization Error');
      debugError('MSG91 configuration failure callback:', errMsg);
      lastInitError = errMsg;

      // Broadcast to any in-flight requests waiting
      for (const listener of globalFailureListeners) {
        try {
          listener(error);
        } catch { }
      }

      if (typeof onFailure === 'function') {
        onFailure(error);
      }
    },
  };

  if (typeof window.initSendOTP === 'function') {
    try {
      window.initSendOTP(window.configuration);
      lastInitError = null;
      debugLog('window.initSendOTP executed.');
      return true;
    } catch (err) {
      lastInitError = err?.message || 'initSendOTP execution failed';
      debugError('initSendOTP invocation error:', err?.message);
      return false;
    }
  }

  return false;
}

/**
 * STEP 1: Send OTP to 10-digit Indian Mobile
 * Method: window.sendOtp(identifier, success, failure) with server-side REST API fallback
 * Identifier format: 91 + 10-digit mobile (no '+') e.g. '919876543210'
 */
export async function sendOtpToMobile(phone) {
  const parsed = parseIndianMobile(phone);
  if (!parsed.valid) {
    throw new Error(parsed.error);
  }

  const { identifier, digits } = parsed;

  if (isSendOtpInFlight) {
    throw new Error('An OTP request is already in progress. Please wait.');
  }

  // Attempt widget initialization if client-side SDK is available
  try {
    await initMsg91Widget();
  } catch (err) {
    debugWarn('initMsg91Widget notice:', err?.message);
  }

  // If the widget SDK methods are still attaching, wait briefly (up to 1200ms) rather than failing immediately
  if (typeof window !== 'undefined' && typeof window.sendOtp !== 'function') {
    const start = Date.now();
    while (Date.now() - start < 1200) {
      if (typeof window.sendOtp === 'function') break;
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  debugLog(`Initiating sendOtp for 91******${digits.slice(-4)}`);

  // Official MSG91 Method 1: window.sendOtp(identifier, success, failure)
  if (typeof window !== 'undefined' && typeof window.sendOtp === 'function') {
    isSendOtpInFlight = true;

    return new Promise((resolve, reject) => {
      let isDone = false;
      let failureHandler = null;

      const cleanup = () => {
        isDone = true;
        isSendOtpInFlight = false;
        if (failureHandler) {
          globalFailureListeners.delete(failureHandler);
        }
        if (timer) {
          clearTimeout(timer);
        }
      };

      // 12-second safe timeout: guarantees loading state never hangs permanently
      const timer = setTimeout(() => {
        if (isDone) return;
        cleanup();

        // Check if authentication failure occurred
        if (lastInitError) {
          reject(
            new Error(
              `MSG91 Error: ${lastInitError}. Please check your MSG91 Widget configuration.`
            )
          );
          return;
        }

        reject(
          new Error(
            'OTP request timed out without response from MSG91. Please check your connection and try again.'
          )
        );
      }, 12000);

      const handleSuccess = (res) => {
        if (isDone) return;
        cleanup();
        debugLog('sendOtp success callback triggered.');
        const reqId = extractReqId(res);
        if (reqId) {
          lastReqId = reqId;
          debugLog('Captured reqId:', reqId);
        }
        resolve({
          type: 'success',
          response: res,
          reqId: reqId || lastReqId,
          message: 'OTP sent successfully to your mobile number.',
        });
      };

      const handleFailure = async (err) => {
        if (isDone) return;
        cleanup();
        let errMsg =
          err?.message ||
          (typeof err === 'string' ? err : null) ||
          'Failed to send OTP via MSG91.';
        debugError('sendOtp failure callback triggered:', errMsg, err);

        // Always attempt server-side REST API fallback if client SDK fails!
        try {
          debugLog('Client sendOtp failed, attempting server-side REST API fallback...');
          const fallbackRes = await authApi.sendOtp({ phone: digits });
          if (
            fallbackRes?.success &&
            (fallbackRes?.data?.reqId || fallbackRes?.data?.type === 'success')
          ) {
            const serverReqId = fallbackRes.data.reqId || lastReqId;
            if (serverReqId) {
              lastReqId = serverReqId;
            }
            resolve({
              type: 'success',
              reqId: serverReqId,
              message: fallbackRes.message || 'OTP sent successfully to your mobile number.',
            });
            return;
          }
        } catch (fbErr) {
          debugError('Server REST fallback after client failure also failed:', fbErr?.message);
          if (fbErr?.message && !fbErr.message.includes('fetch failed')) {
            errMsg = fbErr.message;
          }
        }

        reject(new Error(errMsg));
      };

      // Listen to global MSG91 failure callback in case window.sendOtp fails silently
      failureHandler = async (globalErr) => {
        if (isDone) return;
        cleanup();
        let errMsg =
          globalErr?.message ||
          (typeof globalErr === 'string' ? globalErr : null) ||
          'MSG91 Service Error';
        debugError('Global failure caught during sendOtp:', errMsg);

        try {
          debugLog('Global failure caught, attempting server-side REST API fallback...');
          const fallbackRes = await authApi.sendOtp({ phone: digits });
          if (
            fallbackRes?.success &&
            (fallbackRes?.data?.reqId || fallbackRes?.data?.type === 'success')
          ) {
            const serverReqId = fallbackRes.data.reqId || lastReqId;
            if (serverReqId) {
              lastReqId = serverReqId;
            }
            resolve({
              type: 'success',
              reqId: serverReqId,
              message: fallbackRes.message || 'OTP sent successfully to your mobile number.',
            });
            return;
          }
        } catch (fbErr) {
          debugError('Server REST fallback after global failure also failed:', fbErr?.message);
          if (fbErr?.message && !fbErr.message.includes('fetch failed')) {
            errMsg = fbErr.message;
          }
        }

        reject(new Error(errMsg));
      };
      globalFailureListeners.add(failureHandler);

      try {
        window.sendOtp(identifier, handleSuccess, handleFailure);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  // SERVER-SIDE REST FALLBACK:
  // When window.sendOtp is not available (ad-blocker, script loading blocked, or SDK error),
  // send the real SMS OTP via backend REST API (POST /api/otp/send) using official MSG91 REST endpoint.
  debugLog('Attempting server-side MSG91 REST API sendOtp...');
  try {
    const res = await authApi.sendOtp({ phone: digits });
    if (res?.success && (res?.data?.reqId || res?.data?.type === 'success')) {
      const serverReqId = res.data.reqId || lastReqId;
      if (serverReqId) {
        lastReqId = serverReqId;
      }
      return {
        type: 'success',
        reqId: serverReqId,
        message: res.message || 'OTP sent successfully to your mobile number.',
      };
    }
    if (res?.success) {
      return {
        type: 'success',
        reqId: lastReqId,
        message: res.message || 'OTP sent successfully to your mobile number.',
      };
    }
    throw new Error(res?.message || 'Failed to send OTP via server gateway.');
  } catch (serverErr) {
    debugError('Server-side sendOtp failed:', serverErr?.message);

    // In production mode: surface actual gateway error from backend, never throw mock error
    if (isProduction) {
      throw new Error(
        serverErr?.message ||
          'Failed to send OTP via MSG91 gateway. Please check your mobile number and try again.'
      );
    }

    // Fallback for local development / testing ONLY when running offline without backend
    const mockReqId = `mock-req-91${digits}-${Date.now()}`;
    lastReqId = mockReqId;
    debugLog(`[DEV-MOCK] Simulated OTP sent to +91 ${digits}. Enter 1234 to verify.`);
    return {
      type: 'success',
      reqId: mockReqId,
      message: 'OTP sent successfully (Dev Mock Mode). Use 1234 to verify.',
    };
  }
}

/**
 * STEP 2: Resend / Retry OTP
 * Method: window.retryOtp(channel, success, failure, reqId) with server-side REST API fallback
 * Channel: '11' for SMS
 */
export async function resendOtp(channel = '11') {
  const retryChannel = channel || '11';

  // Official MSG91 Method 2: window.retryOtp(channel, success, failure, reqId)
  if (typeof window !== 'undefined' && typeof window.retryOtp === 'function') {
    try {
      const clientResult = await new Promise((resolve, reject) => {
        let isDone = false;
        let failureHandler = null;

        const cleanup = () => {
          isDone = true;
          if (failureHandler) {
            globalFailureListeners.delete(failureHandler);
          }
          if (timer) {
            clearTimeout(timer);
          }
        };

        const timer = setTimeout(() => {
          if (isDone) return;
          cleanup();
          reject(new Error('Resend OTP request timed out. Please try again.'));
        }, 12000);

        const handleSuccess = (res) => {
          if (isDone) return;
          cleanup();
          debugLog('retryOtp success callback triggered.');
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
          if (isDone) return;
          cleanup();
          const errMsg =
            err?.message ||
            (typeof err === 'string' ? err : null) ||
            'Failed to resend OTP via MSG91.';
          debugError('retryOtp failure callback triggered:', errMsg);
          reject(new Error(errMsg));
        };

        failureHandler = (globalErr) => {
          if (isDone) return;
          cleanup();
          const errMsg =
            globalErr?.message ||
            (typeof globalErr === 'string' ? globalErr : null) ||
            'MSG91 Resend Error';
          reject(new Error(errMsg));
        };
        globalFailureListeners.add(failureHandler);

        try {
          window.retryOtp(retryChannel, handleSuccess, handleFailure, lastReqId || undefined);
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      return clientResult;
    } catch (clientErr) {
      debugWarn(
        'Client window.retryOtp failed, falling back to server-side REST API:',
        clientErr?.message
      );
    }
  }

  // SERVER-SIDE REST FALLBACK:
  try {
    const res = await authApi.retryOtp({ reqId: lastReqId, channel: retryChannel });
    if (res?.success) {
      return {
        type: 'success',
        reqId: res?.data?.reqId || lastReqId,
        message: res?.message || 'OTP resent successfully.',
      };
    }
    throw new Error(res?.message || 'Failed to resend OTP via server gateway.');
  } catch (serverErr) {
    if (isProduction) {
      throw new Error(
        serverErr?.message || 'Failed to resend OTP via MSG91 gateway. Please try again.'
      );
    }

    debugLog('[DEV-MOCK] Simulated OTP resent.');
    return {
      type: 'success',
      reqId: lastReqId,
      message: 'OTP resent successfully.',
    };
  }
}

/**
 * STEP 3: Verify OTP Code
 * Method: window.verifyOtp(otp, success, failure, reqId) with server-side REST API fallback
 * Captures access token returned by MSG91 upon success, or verifies via backend REST API
 */
export async function verifyOtpCode(otp, phone) {
  const cleanOtp = String(otp || '').trim();
  if (!cleanOtp || cleanOtp.length !== 4) {
    throw new Error('Please enter a valid 4-digit OTP.');
  }

  const parsed = parseIndianMobile(phone);
  const normalizedPhone = parsed.valid ? parsed.digits : String(phone || '').replace(/\D/g, '');

  // Official MSG91 Method 3: window.verifyOtp(otp, success, failure, reqId)
  if (typeof window !== 'undefined' && typeof window.verifyOtp === 'function') {
    try {
      const clientResult = await new Promise((resolve, reject) => {
        let isDone = false;
        let failureHandler = null;

        const cleanup = () => {
          isDone = true;
          if (failureHandler) {
            globalFailureListeners.delete(failureHandler);
          }
          if (timer) {
            clearTimeout(timer);
          }
        };

        const timer = setTimeout(() => {
          if (isDone) return;
          cleanup();
          reject(new Error('OTP verification timed out. Please try again.'));
        }, 12000);

        const handleSuccess = (res) => {
          if (isDone) return;
          cleanup();
          debugLog('verifyOtp success callback triggered.');
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
          if (isDone) return;
          cleanup();
          const errMsg =
            err?.message ||
            (typeof err === 'string' ? err : null) ||
            'Invalid OTP. Please check and try again.';
          debugError('verifyOtp failure callback triggered:', errMsg);
          reject(new Error(errMsg));
        };

        failureHandler = (globalErr) => {
          if (isDone) return;
          cleanup();
          const errMsg =
            globalErr?.message ||
            (typeof globalErr === 'string' ? globalErr : null) ||
            'MSG91 Verification Error';
          reject(new Error(errMsg));
        };
        globalFailureListeners.add(failureHandler);

        try {
          window.verifyOtp(cleanOtp, handleSuccess, handleFailure, lastReqId || undefined);
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      return clientResult;
    } catch (clientErr) {
      debugWarn(
        'Client window.verifyOtp failed, falling back to server-side REST API:',
        clientErr?.message
      );
    }
  }

  // SERVER-SIDE REST FALLBACK:
  // Calls POST /api/otp/verify which directly verifies the OTP with MSG91 and creates a verification session
  try {
    const res = await authApi.verifyOtp({
      reqId: lastReqId,
      otp: cleanOtp,
      phone: normalizedPhone,
    });

    if (res?.success && res?.data?.verificationSessionId) {
      if (res.data.accessToken) {
        lastVerifiedAccessToken = res.data.accessToken;
      }
      return {
        response: res,
        accessToken: res.data.accessToken || `verified-session-${res.data.verificationSessionId}`,
        verificationSessionId: res.data.verificationSessionId,
      };
    }
    throw new Error(res?.message || 'Incorrect OTP or verification failed.');
  } catch (serverErr) {
    if (isProduction) {
      throw new Error(serverErr?.message || 'Incorrect OTP. Please check and try again.');
    }

    // Local development mock fallback (only non-production)
    if (cleanOtp === '1234') {
      const mockAccessToken = `mock-access-token-91${normalizedPhone}-${Date.now()}`;
      lastVerifiedAccessToken = mockAccessToken;
      return {
        response: { type: 'success', message: 'Verified' },
        accessToken: mockAccessToken,
      };
    }

    throw new Error(
      serverErr?.message || 'Incorrect OTP. Please enter the 4-digit OTP sent to your phone.'
    );
  }
}
