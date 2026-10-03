import { apiClient } from './apiClient.js';

export const adminApi = {
  /**
   * Get executive system metrics & aggregated dashboard statistics
   */
  async getDashboard() {
    try {
      return await apiClient.get('/admin/dashboard');
    } catch {
      return apiClient.get('/admin/metrics');
    }
  },

  /**
   * System metrics
   */
  async getMetrics() {
    return apiClient.get('/admin/metrics');
  },

  /**
   * List distributors with filtering, search & pagination
   * @param {Object} params - { page, limit, search, status, position, rank }
   */
  async listDistributors(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    const query = new URLSearchParams(cleanParams).toString();
    return apiClient.get(`/admin/distributors${query ? `?${query}` : ''}`);
  },

  /**
   * Get distributor by ID with full details, sponsor, parent, children, BV & stats
   */
  async getDistributor(id) {
    return apiClient.get(`/admin/distributors/${encodeURIComponent(id)}`);
  },

  /**
   * Update distributor account status (ACTIVE, INACTIVE, SUSPENDED)
   */
  async updateStatus(id, status) {
    return apiClient.patch(`/admin/distributors/${encodeURIComponent(id)}/status`, { status });
  },

  /**
   * Update distributor profile information
   */
  async updateDistributor(id, data) {
    return apiClient.put(`/admin/distributors/${encodeURIComponent(id)}`, data);
  },

  /**
   * Get any distributor's binary network tree
   */
  async getNetwork(distributorId = 'KV-1001', depth = 3) {
    return apiClient.get(`/admin/network/${encodeURIComponent(distributorId)}?depth=${depth}`);
  },

  /**
   * Global binary tree with root and depth
   */
  async getNetworkTree(rootId = 'KV-1001', depth = 3) {
    return apiClient.get(`/admin/network-tree?memberId=${encodeURIComponent(rootId)}&depth=${depth}`);
  },

  /**
   * System-wide Business Volume transactions & summaries
   */
  async getBusinessVolume(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/business-volume${query ? `?${query}` : ''}`);
  },

  /**
   * Admin manual BV adjustment with reason & audit logging
   * @param {Object} data - { distributorId, businessVolume, type, reason, orderId, amount }
   */
  async adjustBusinessVolume(data) {
    return apiClient.post('/admin/business-volume/adjust', data);
  },

  /**
   * System-wide Commission ledger
   */
  async getCommissions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/commissions${query ? `?${query}` : ''}`);
  },

  /**
   * Trigger weekly commission calculation cycle
   */
  async calculateCommissions(data = { cycleWeek: 38, cycleYear: 2026 }) {
    return apiClient.post('/admin/calculate-commissions', data);
  },

  /**
   * Approve calculated commission records
   */
  async approveCommissions(data) {
    return apiClient.post('/admin/commissions/approve', data);
  },

  /**
   * Settle payout batch
   */
  async settlePayouts(data = { batchCode: `BATCH-${new Date().getFullYear()}-W38` }) {
    return apiClient.post('/admin/settle-payouts', data);
  },

  /**
   * Reverse commission record with mandatory reason
   */
  async reverseCommission(data) {
    return apiClient.post('/admin/commissions/reverse', data);
  },

  /**
   * Immutable compliance audit trail
   */
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },

  /**
   * Get active commission calculation rules & thresholds
   */
  async getSettings() {
    return apiClient.get('/admin/settings');
  },

  /**
   * Update commission rules with administrative audit logging
   */
  async updateSettings(data) {
    return apiClient.put('/admin/settings', data);
  },
};

export default adminApi;
