import { apiClient } from './apiClient.js';

export const businessVolumeApi = {
  /**
   * Get Business Volume summary (Personal, Left, Right, Total, Carry-forward)
   */
  async getSummary(distributorId) {
    if (!distributorId) {
      return apiClient.get('/distributors/me/business-volume');
    }
    return apiClient.get(`/business-volume/summary/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Get eligible transaction ledger
   */
  async getTransactions(distributorId) {
    const endpoint = distributorId
      ? `/business-volume/transactions/${encodeURIComponent(distributorId)}`
      : '/distributors/me/business-volume';
    return apiClient.get(endpoint);
  },

  /**
   * Get system-wide volume (admin only)
   */
  async getAdminVolume() {
    return apiClient.get('/admin/business-volume');
  },
};

export default businessVolumeApi;
