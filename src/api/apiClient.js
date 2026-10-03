/**
 * KashviMLM Centralized API Client
 * Enterprise HTTP Client with Auth Interceptors, HttpOnly Cookie Refresh & Error Normalization
 */

const getApiBaseUrl = () => {
  const envUrl = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api';
  }
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshPromise = null;
    this.onUnauthorizedCallbacks = new Set();
  }

  setToken(token) {
    this.accessToken = token || null;
    if (token) {
      localStorage.setItem('kashvi_token', token);
    } else {
      localStorage.removeItem('kashvi_token');
    }
  }

  clearToken() {
    this.accessToken = null;
    localStorage.removeItem('kashvi_token');
  }

  onUnauthorized(callback) {
    this.onUnauthorizedCallbacks.add(callback);
    return () => this.onUnauthorizedCallbacks.delete(callback);
  }

  getToken() {
    if (this.accessToken) return this.accessToken;
    try {
      const explicitToken = localStorage.getItem('kashvi_token');
      if (explicitToken) {
        this.accessToken = explicitToken;
        return explicitToken;
      }

      const authStr = localStorage.getItem('kashvi_auth');
      if (authStr) {
        const parsed = JSON.parse(authStr);
        const t = parsed.token || parsed.accessToken || (parsed.user && parsed.user.token) || null;
        if (t) {
          this.accessToken = t;
          return t;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    const headers = this.getHeaders(options.headers);
    const config = {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        const isAuthRoute =
          cleanEndpoint.includes('/auth/login') ||
          cleanEndpoint.includes('/auth/register') ||
          cleanEndpoint.includes('/auth/logout');
        const isRefreshRoute = cleanEndpoint.includes('/auth/refresh') || options._isRefreshRequest;

        // If this is an expired token on a normal protected route, attempt silent refresh via HttpOnly cookie
        if (!isAuthRoute && !isRefreshRoute && !options._retry) {
          if (!this.refreshPromise) {
            this.refreshPromise = this.request('/auth/refresh', {
              method: 'POST',
              _isRefreshRequest: true,
            })
              .then((res) => {
                const refreshedToken =
                  res?.data?.accessToken ||
                  res?.accessToken ||
                  res?.tokens?.accessToken ||
                  res?.data?.tokens?.accessToken;
                if (refreshedToken) {
                  this.setToken(refreshedToken);
                  return refreshedToken;
                }
                return null;
              })
              .catch((refreshErr) => {
                this.handle401();
                throw refreshErr;
              })
              .finally(() => {
                this.refreshPromise = null;
              });
          }

          const refreshedToken = await this.refreshPromise;
          if (refreshedToken) {
            return this.request(endpoint, {
              ...options,
              _retry: true,
            });
          }
        }

        // If refresh failed or route was refresh/logout
        if (isRefreshRoute || options._retry) {
          this.handle401();
        }
      }

      let data = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = text ? { raw: text } : null;
        }
      }

      if (!response.ok) {
        const error = new Error(
          data?.message || data?.error || `HTTP request failed with status ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        error.isAuthError = response.status === 401;
        error.isForbidden = response.status === 403;
        error.isNotFound = response.status === 404;
        error.isValidationError = response.status === 422 || response.status === 400;
        throw error;
      }

      return data;
    } catch (err) {
      if (err.status) {
        throw err;
      }
      // Network or offline error
      const networkError = new Error(err.message || 'Network connection failed. Please check backend server.');
      networkError.status = 0;
      networkError.isNetworkError = true;
      throw networkError;
    }
  }

  handle401() {
    try {
      this.clearToken();
      const authStr = localStorage.getItem('kashvi_auth');
      if (authStr) {
        const parsed = JSON.parse(authStr);
        parsed.isLoggedIn = false;
        parsed.token = null;
        localStorage.setItem('kashvi_auth', JSON.stringify(parsed));
      }
      window.dispatchEvent(new CustomEvent('kashvi_unauthorized'));
    } catch {
      // ignore
    }

    this.onUnauthorizedCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in onUnauthorized callback:', e);
      }
    });
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
