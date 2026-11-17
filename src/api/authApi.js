import { apiClient } from './apiClient.js';

export const authApi = {
  /**
   * Login with email or username + password (+ optional sponsorId)
   */
  async login({ email, phone, username, identifier, password, sponsorId, rememberMe }) {
    const payload = {
      password,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(username ? { username } : {}),
      ...(identifier ? { identifier } : {}),
      ...(sponsorId ? { sponsorId } : {}),
      ...(rememberMe !== undefined ? { rememberMe } : {}),
    };
    return apiClient.post('/auth/login', payload);
  },

  /**
   * Register a new distributor
   */
  async register(registrationData) {
    return apiClient.post('/auth/register', registrationData);
  },

  /**
   * Get public MSG91 widget configuration
   */
  async getOtpConfig() {
    return apiClient.get('/otp/config');
  },

  /**
   * Send OTP to phone number via server-side MSG91 REST API
   */
  async sendOtp({ phone }) {
    return apiClient.post('/otp/send', { phone });
  },

  /**
   * Resend/retry OTP via server-side MSG91 REST API
   */
  async retryOtp({ reqId, channel }) {
    return apiClient.post('/otp/retry', { reqId, channel });
  },

  /**
   * Verify OTP code via server-side MSG91 REST API
   */
  async verifyOtp({ reqId, otp, phone }) {
    return apiClient.post('/otp/verify', { reqId, otp, phone });
  },

  /**
   * Verify MSG91 Access Token on backend and obtain verification session
   */
  async verifyOtpToken({ accessToken, phone }) {
    return apiClient.post('/otp/verify-token', { accessToken, phone });
  },

  /**
   * Log out current session
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('kashvi_token');
      localStorage.removeItem('kashvi_auth');
      window.dispatchEvent(new Event('kashvi_auth_change'));
    }
  },

  /**
   * Refresh session and retrieve fresh access token via HttpOnly cookie
   */
  async refresh() {
    return apiClient.post('/auth/refresh', {});
  },

  /**
   * Get authenticated user profile & session
   */
  async getMe() {
    return apiClient.get('/auth/me');
  },

  /**
   * Update authenticated user profile (Personal Details, Proper Delivery Address, Bank Details)
   */
  async updateProfile(profileData) {
    return apiClient.put('/auth/profile', profileData);
  },

  /**
   * Securely change password
   */
  async changePassword({ currentPassword, newPassword, confirmPassword }) {
    return apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  },

  /**
   * Request password reset token
   */
  async forgotPassword(email) {
    return apiClient.post('/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword({ token, newPassword, confirmPassword }) {
    return apiClient.post('/auth/reset-password', {
      token,
      newPassword,
      confirmPassword,
    });
  },
};

export default authApi;
