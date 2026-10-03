import { apiClient } from './apiClient.js';

export const treeApi = {
  /**
   * Retrieve binary network tree starting from distributorId up to depth
   */
  async getTree(distributorId, depth = 3) {
    return apiClient.get(`/tree/${encodeURIComponent(distributorId)}?depth=${depth}`);
  },

  /**
   * Retrieve direct binary children (LEFT and RIGHT)
   */
  async getDirectChildren(distributorId) {
    return apiClient.get(`/tree/children/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Retrieve placement parent
   */
  async getParent(distributorId) {
    return apiClient.get(`/tree/parent/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Retrieve direct sponsor
   */
  async getSponsor(distributorId) {
    return apiClient.get(`/tree/sponsor/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Retrieve full downline with pagination/filtering
   */
  async getDownline(distributorId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/tree/downline/${encodeURIComponent(distributorId)}${query ? `?${query}` : ''}`);
  },

  /**
   * Retrieve LEFT subtree downline
   */
  async getLeftDownline(distributorId) {
    return apiClient.get(`/tree/downline/${encodeURIComponent(distributorId)}/left`);
  },

  /**
   * Retrieve RIGHT subtree downline
   */
  async getRightDownline(distributorId) {
    return apiClient.get(`/tree/downline/${encodeURIComponent(distributorId)}/right`);
  },

  /**
   * Retrieve network statistics (leftCount, rightCount, totalCount, depth)
   */
  async getNetworkStats(distributorId) {
    return apiClient.get(`/tree/stats/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Retrieve hierarchy path from root to distributor
   */
  async getPath(distributorId) {
    return apiClient.get(`/tree/path/${encodeURIComponent(distributorId)}`);
  },

  /**
   * Search within distributor's permitted downline
   */
  async searchDownline(distributorId, query) {
    return apiClient.get(`/tree/${encodeURIComponent(distributorId)}/search?query=${encodeURIComponent(query)}`);
  },

  /**
   * Validate sponsor ID
   */
  async validateSponsor(sponsorId) {
    return apiClient.get(`/v1/sponsors/${encodeURIComponent(sponsorId)}`);
  },
};

export default treeApi;
