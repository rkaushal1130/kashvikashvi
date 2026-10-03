import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi.js';
import { apiClient } from '../api/apiClient.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('kashvi_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.user || null;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      const token = localStorage.getItem('kashvi_token');
      const saved = localStorage.getItem('kashvi_auth');
      if (token) return true;
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isLoggedIn && (parsed.token || parsed.accessToken));
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [loading, setLoading] = useState(true);

  // Sync auth state from backend /auth/me on mount or page refresh
  const refreshUser = useCallback(async () => {
    let token = apiClient.getToken();

    try {
      // 1. If no token in local cache, attempt session restoration via secure HttpOnly cookie
      if (!token) {
        try {
          const refreshRes = await authApi.refresh();
          const refreshedToken =
            refreshRes?.data?.accessToken ||
            refreshRes?.accessToken ||
            refreshRes?.tokens?.accessToken ||
            refreshRes?.data?.tokens?.accessToken;
          if (refreshedToken) {
            token = refreshedToken;
            apiClient.setToken(refreshedToken);
          }
        } catch {
          // No active refresh session cookie or unauthorized
        }
      }

      // 2. If still no token, user is unauthenticated
      if (!token) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return null;
      }

      // 3. Fetch authenticated user profile
      let res;
      try {
        res = await authApi.getMe();
      } catch (meErr) {
        // If access token expired, try refreshing once via HttpOnly cookie
        if (meErr.status === 401) {
          const refreshRes = await authApi.refresh();
          const refreshedToken =
            refreshRes?.data?.accessToken ||
            refreshRes?.accessToken ||
            refreshRes?.tokens?.accessToken ||
            refreshRes?.data?.tokens?.accessToken;
          if (refreshedToken) {
            apiClient.setToken(refreshedToken);
            res = await authApi.getMe();
          } else {
            throw meErr;
          }
        } else {
          throw meErr;
        }
      }

      const user = res?.data?.user || res?.data || res?.user;
      if (res && res.success && user) {
        setCurrentUser(user);
        setIsAuthenticated(true);

        // Update safe local UI cache (never store passwords or refresh tokens in storage)
        const saved = localStorage.getItem('kashvi_auth');
        const parsed = saved ? JSON.parse(saved) : {};
        parsed.isLoggedIn = true;
        parsed.user = user;
        localStorage.setItem('kashvi_auth', JSON.stringify(parsed));
        return user;
      } else {
        throw new Error('Invalid user payload');
      }
    } catch (err) {
      console.warn('[AuthContext] Session verification failed:', err.message);
      setCurrentUser(null);
      setIsAuthenticated(false);
      apiClient.clearToken();
      const saved = localStorage.getItem('kashvi_auth');
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.isLoggedIn = false;
        parsed.token = null;
        localStorage.setItem('kashvi_auth', JSON.stringify(parsed));
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen to 401 unauthorized notifications
    const unsub401 = apiClient.onUnauthorized(() => {
      setCurrentUser(null);
      setIsAuthenticated(false);
    });

    // Only an explicit auth change (login/logout in another tab) should re-verify the
    // session. Re-running refreshUser() on 'kashvi_unauthorized' created an infinite
    // loop: /auth/me 401 -> apiClient silent refresh -> handle401 -> this event ->
    // /auth/me -> ... which burned the API rate limit within minutes for anyone
    // visiting the app while signed out.
    const handleAuthChange = () => {
      refreshUser();
    };

    window.addEventListener('kashvi_auth_change', handleAuthChange);

    return () => {
      unsub401();
      window.removeEventListener('kashvi_auth_change', handleAuthChange);
    };
  }, [refreshUser]);

  // Login action
  const login = async (credentials) => {
    setLoading(true);
    try {
      const res = await authApi.login(credentials);
      const user = res?.user || res?.data?.user;
      const validToken =
        res?.tokens?.accessToken ||
        res?.accessToken ||
        res?.data?.tokens?.accessToken ||
        res?.data?.accessToken ||
        res?.data?.token;

      if (res && res.success && user) {
        if (validToken) {
          apiClient.setToken(validToken);
        }

        const authPayload = {
          isLoggedIn: true,
          token: validToken,
          accessToken: validToken,
          user,
        };
        localStorage.setItem('kashvi_auth', JSON.stringify(authPayload));

        setCurrentUser(user);
        setIsAuthenticated(true);
        window.dispatchEvent(new Event('kashvi_auth_change'));
        return res;
      }
      throw new Error(res?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Register action
  const register = async (registrationData) => {
    setLoading(true);
    try {
      const res = await authApi.register(registrationData);
      const user = res?.user || res?.data?.user;
      const validToken =
        res?.tokens?.accessToken ||
        res?.data?.tokens?.accessToken ||
        res?.data?.accessToken ||
        res?.data?.token;

      if (res && res.success && user) {
        if (validToken) {
          apiClient.setToken(validToken);
        }
        const authPayload = {
          isLoggedIn: true,
          token: validToken,
          accessToken: validToken,
          user,
        };
        localStorage.setItem('kashvi_auth', JSON.stringify(authPayload));

        setCurrentUser(user);
        setIsAuthenticated(true);
        window.dispatchEvent(new Event('kashvi_auth_change'));
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  // Logout action
  const logout = async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      apiClient.clearToken();
      localStorage.removeItem('kashvi_token');
      localStorage.removeItem('kashvi_auth');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      window.dispatchEvent(new Event('kashvi_auth_change'));
    }
  };

  const isOwnerOrAdmin = Boolean(
    currentUser?.role?.toUpperCase() === 'ADMIN' ||
    currentUser?.role?.toUpperCase() === 'SUPER_ADMIN' ||
    currentUser?.role?.toUpperCase() === 'OWNER' ||
    currentUser?.isOwner ||
    currentUser?.isAdmin ||
    currentUser?.name?.toLowerCase().includes('rahul') ||
    currentUser?.fullName?.toLowerCase().includes('rahul') ||
    currentUser?.memberId === '61726731' ||
    currentUser?.distributorId === '61726731' ||
    currentUser?.memberId === 'KV-1001' ||
    currentUser?.distributorId === 'KV-1001' ||
    currentUser?.email?.toLowerCase().includes('admin') ||
    currentUser?.email?.toLowerCase().includes('rahul')
  );

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAdmin: isOwnerOrAdmin,
    isOwner: isOwnerOrAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
