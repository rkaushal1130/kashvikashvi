import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi.js';
import { apiClient } from '../api/apiClient.js';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

const findLegacyLocalRegistration = (credentials) => {
  const identifier = String(
    credentials?.identifier || credentials?.phone || credentials?.email || credentials?.username || ''
  ).trim();
  if (!identifier || typeof window === 'undefined') return null;

  try {
    const accounts = JSON.parse(localStorage.getItem('kashvi_registered_users') || '[]');
    const normalized = identifier.toLowerCase();
    const digits = identifier.replace(/\D/g, '');
    return accounts.find((account) => {
      const emailMatches = account.email?.toLowerCase() === normalized;
      const phoneDigits = String(account.phone || '').replace(/\D/g, '');
      const phoneMatches = digits.length >= 7 && phoneDigits &&
        (phoneDigits === digits || phoneDigits.slice(-10) === digits.slice(-10));
      return (emailMatches || phoneMatches) && account.password === credentials.password;
    }) || null;
  } catch {
    return null;
  }
};

const clearLegacyLocalPassword = (account) => {
  try {
    const accounts = JSON.parse(localStorage.getItem('kashvi_registered_users') || '[]');
    localStorage.setItem('kashvi_registered_users', JSON.stringify(
      accounts.map((item) => {
        const sameEmail = account.email && item.email?.toLowerCase() === account.email.toLowerCase();
        const samePhone = account.phone && item.phone === account.phone;
        if (sameEmail || samePhone) {
          const safeAccount = { ...item };
          delete safeAccount.password;
          return safeAccount;
        }
        return item;
      })
    ));
  } catch {
    // The server account is already created; local cleanup is best effort.
  }
};

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
      const saved = localStorage.getItem('kashvi_auth');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.isLoggedIn && parsed.user) {
            setCurrentUser(parsed.user);
            setIsAuthenticated(true);
            return parsed.user;
          }
        } catch {
          // ignore
        }
      }
      setCurrentUser(null);
      setIsAuthenticated(false);
      apiClient.clearToken();
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.isLoggedIn = false;
          parsed.token = null;
          localStorage.setItem('kashvi_auth', JSON.stringify(parsed));
        } catch {
          // ignore
        }
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

    const handleAuthChange = (e) => {
      if (e?.detail?.type === 'logout') {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      if (e?.detail?.type === 'login') {
        return;
      }
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
      let res;
      try {
        res = await authApi.login(credentials);
      } catch (loginError) {
        const legacyAccount = loginError?.status === 401
          ? findLegacyLocalRegistration(credentials)
          : null;
        if (!legacyAccount) throw loginError;

        // Older clients could falsely complete registration locally when the
        // server was unavailable. Migrate that account through the real,
        // password-hashing registration endpoint on its first valid login.
        try {
          res = await authApi.register({
            fullName: legacyAccount.fullName || legacyAccount.name,
            email: legacyAccount.email,
            phone: legacyAccount.phone,
            password: credentials.password,
            confirmPassword: credentials.password,
            referralCode: legacyAccount.sponsorId || 'KV-1001',
            sponsorId: legacyAccount.sponsorId || 'KV-1001',
          });
          clearLegacyLocalPassword(legacyAccount);
        } catch (migrationError) {
          if (migrationError?.status === 409) throw loginError;
          throw migrationError;
        }
      }

      const user = res?.data?.user || res?.user;
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
        window.dispatchEvent(new CustomEvent('kashvi_auth_change', { detail: { type: 'login' } }));
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

      const user = res?.data?.user || res?.user;
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

        // Keep non-secret profile data for local tree and referral displays.
        try {
          const raw = localStorage.getItem('kashvi_registered_users');
          const list = raw ? JSON.parse(raw) : [];
          const cleanEmail = (registrationData.email || user.email || '').trim().toLowerCase();
          const idx = list.findIndex((u) => u.email?.toLowerCase() === cleanEmail);
          const safeUser = { ...user };
          delete safeUser.password;
          const regEntry = safeUser;
          if (idx >= 0) {
            list[idx] = regEntry;
          } else {
            list.push(regEntry);
          }
          localStorage.setItem('kashvi_registered_users', JSON.stringify(list));
        } catch {
          // ignore
        }

        // Sync into kashvi_enrolled_tree_members for immediate tree view update
        try {
          const rawSponsor = user.sponsorId || registrationData.sponsorId || registrationData.referralCode || 'KV-1001';
          const chosenPos = user.placementPosition || registrationData.placementPosition || 'AUTO';
          const dynamicPlacement = api.findBinaryPlacement(rawSponsor, chosenPos);

          const memberDistId = user.distributorId || user.distributorCode || user.memberId || api.getNextDistributorId();
          const treeNodeId = user.treeId || `node-${String(memberDistId).toLowerCase()}`;
          const rawTree = localStorage.getItem('kashvi_enrolled_tree_members');
          const treeList = rawTree ? JSON.parse(rawTree) : [];
          const existingIdx = treeList.findIndex((m) => m.distributorId === memberDistId);

          const finalName = user.name || user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'New Distributor';

          // Enrich user object
          user.distributorId = memberDistId;
          user.distributorCode = memberDistId;
          user.memberId = memberDistId;
          user.name = finalName;
          user.fullName = finalName;
          user.placementParent = user.placementParent || dynamicPlacement.placementParent;
          user.placementParentName = user.placementParentName || dynamicPlacement.placementParentName;
          user.placementPosition = user.placementPosition || dynamicPlacement.position;
          user.sponsorId = user.sponsorId || dynamicPlacement.sponsorId;

          const treeEntry = {
            id: treeNodeId,
            treeId: treeNodeId,
            distributorId: memberDistId,
            name: finalName,
            status: user.status || 'PENDING_PAYMENT',
            paymentStatus: user.paymentStatus || 'PENDING',
            rank: user.currentRank?.name || 'Associate',
            position: user.placementPosition || dynamicPlacement.position,
            joinedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            sponsor: user.sponsorId || dynamicPlacement.sponsorId,
            sponsorName: user.sponsor?.name || dynamicPlacement.sponsorName,
            placementParent: user.placementParent || dynamicPlacement.placementParent,
            placementParentName: user.placementParentName || dynamicPlacement.placementParentName,
            businessCenter: 'BC-001',
            bv: 100,
          };
          if (existingIdx >= 0) {
            treeList[existingIdx] = { ...treeList[existingIdx], ...treeEntry };
          } else {
            treeList.push(treeEntry);
          }
          localStorage.setItem('kashvi_enrolled_tree_members', JSON.stringify(treeList));

          // Also update kashvi_registered_users with enriched memberId/placement info
          try {
            const rawReg = localStorage.getItem('kashvi_registered_users');
            const regList = rawReg ? JSON.parse(rawReg) : [];
            const rIdx = regList.findIndex((u) => u.email?.toLowerCase() === user.email?.toLowerCase() || u.distributorId === memberDistId);
            if (rIdx >= 0) {
              regList[rIdx] = { ...regList[rIdx], ...user };
              localStorage.setItem('kashvi_registered_users', JSON.stringify(regList));
            }
          } catch {
            // ignore
          }

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kashvi_tree_updated', { detail: treeEntry }));
            try {
              window.dispatchEvent(new StorageEvent('storage', {
                key: 'kashvi_enrolled_tree_members',
                newValue: JSON.stringify(treeList),
              }));
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore
        }

        setCurrentUser(user);
        setIsAuthenticated(true);
        window.dispatchEvent(new CustomEvent('kashvi_auth_change', { detail: { type: 'login' } }));
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
      localStorage.removeItem('kashvi_current_user');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      window.dispatchEvent(new CustomEvent('kashvi_auth_change', { detail: { type: 'logout' } }));
    }
  };

  // Resolve UI role from the authenticated role plus the app's KV admin ID convention.
  const userRole = (currentUser?.role || currentUser?.roleName || '').toString().toUpperCase();
  const accountIds = [
    currentUser?.distributorCode,
    currentUser?.distributorId,
    currentUser?.memberId,
    currentUser?.id,
  ].filter(Boolean).map(String);
  const hasAdminId = accountIds.some((id) => /^KV(?:-|$)/i.test(id));
  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || hasAdminId;
  const rolePermissions = currentUser?.rolePermissions || currentUser?.role?.permissions;
  const isOwner = Boolean(
    userRole === 'SUPER_ADMIN' ||
    rolePermissions?.all === true ||
    rolePermissions?.root === true
  );
  const canManageProducts = Boolean(
    isAdmin ||
    isOwner ||
    rolePermissions?.manage_products === true
  );

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    refreshUser,
    isAdmin,
    isOwner,
    canManageProducts,
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
