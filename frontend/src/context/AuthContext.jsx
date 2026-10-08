import React, { createContext, useState, useContext, useCallback } from 'react';
import { safeJson } from '../utils/safeJson';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('drscp_token') || '');
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('drscp_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (netErr) {
      throw new Error('Backend server is unreachable. Please verify server is running on port 5000.');
    }

    const data = await safeJson(res) || {};

    if (!res.ok) {
      throw new Error(data.error || 'Login failed (' + res.status + ')');
    }

    if (!data.token || !data.user) {
      throw new Error('Invalid response from authentication server');
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('drscp_token', data.token);
    localStorage.setItem('drscp_user', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('drscp_token');
    localStorage.removeItem('drscp_user');
  };

  const authFetch = useCallback(async (url, opts = {}) => {
    const currentToken = localStorage.getItem('drscp_token') || token;
    const headers = {
      ...(opts.headers || {}),
      'Content-Type': 'application/json',
    };
    if (currentToken) {
      headers['Authorization'] = 'Bearer ' + currentToken;
    }
    try {
      return await fetch(url, { ...opts, headers });
    } catch (err) {
      console.warn('Network error during fetch to ' + url + ':', err.message);
      // Return a simulated response with empty body rather than throwing
      return new Response('', { status: 503, statusText: 'Service Unavailable' });
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
