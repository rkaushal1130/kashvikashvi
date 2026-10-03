import { apiClient } from './apiClient.js';

export const commissionApi = {
  /**
   * Get commissions for authenticated distributor
   */
  async getCommissions() {
    return apiClient.get('/distributors/me/commissions');
  },

  /**
   * Get commission summary for distributor
   */
  async getSummary(distributorId) {
    if (!distributorId) {
      return apiClient.get('/distributors/me/commissions');
    }
    return apiClient.get(`/commission/summary/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Get commission ledger/history for distributor
   */
  async getLedger(distributorId) {
    if (!distributorId) {
      return apiClient.get('/distributors/me/commissions');
    }
    return apiClient.get(`/commission/ledger/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Get system-wide commissions (admin only)
   */
  async getAdminCommissions() {
    return apiClient.get('/admin/commissions');
  },
};

export default commissionApi;
