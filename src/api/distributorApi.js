import { apiClient } from './apiClient.js';

export const distributorApi = {
  /**
   * Get authenticated distributor's profile
   */
  async getMe() {
    return apiClient.get('/distributors/me');
  },

  /**
   * Update authenticated distributor's profile (name, phone)
   */
  async updateMe(data) {
    return apiClient.patch('/distributors/me', data);
  },

  /**
   * Get authenticated distributor's binary network
   */
  async getMeNetwork(depth = 3) {
    return apiClient.get(`/distributors/me/network?depth=${depth}`);
  },

  /**
   * Get authenticated distributor's downline list
   */
  async getMeDownline(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/distributors/me/downline${query ? `?${query}` : ''}`);
  },

  /**
   * Get authenticated distributor's business volume summary
   */
  async getMeBusinessVolume() {
    return apiClient.get('/distributors/me/business-volume');
  },

  /**
   * Get authenticated distributor's commission history
   */
  async getMeCommissions() {
    return apiClient.get('/distributors/me/commissions');
  },

  /**
   * Get referral link for distributor
   */
  async getReferralLink(memberId) {
    const endpoint = memberId
      ? `/distributors/referral-link/${encodeURIComponent(memberId)}`
      : '/distributors/me/referral-link';
    return apiClient.get(endpoint);
  },

  /**
   * Get profile by ID (if permitted or admin)
   */
  async getProfile(memberId) {
    return apiClient.get(`/distributors/profile/${encodeURIComponent(memberId)}`);
  },
};

export default distributorApi;
