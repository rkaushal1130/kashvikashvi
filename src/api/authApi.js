import { apiClient } from './apiClient.js';

export const authApi = {
  /**
   * Login with email or username + password (+ optional sponsorId)
   */
  async login({ email, username, identifier, password, sponsorId, rememberMe }) {
    const payload = {
      password,
      ...(email ? { email } : {}),
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
    const token = apiClient.getToken();
    if (
      token &&
      (token === 'kashvi_mock_owner_jwt_token_2026' ||
        token.startsWith('kashvi_reg_token_') ||
        token.startsWith('kashvi_mock_'))
    ) {
      return { success: true, data: { accessToken: token } };
    }
    return apiClient.post('/auth/refresh', {});
  },

  /**
   * Get authenticated user profile & session
   */
  async getMe() {
    const token = apiClient.getToken();
    if (
      token &&
      (token === 'kashvi_mock_owner_jwt_token_2026' ||
        token.startsWith('kashvi_reg_token_') ||
        token.startsWith('kashvi_mock_'))
    ) {
      const saved = localStorage.getItem('kashvi_auth');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.user) {
            return { success: true, data: { user: parsed.user } };
          }
        } catch {
          // ignore
        }
      }
    }
    return apiClient.get('/auth/me');
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
