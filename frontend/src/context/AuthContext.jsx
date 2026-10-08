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

  const getApiUrl = (endpoint) => {
    // If endpoint starts with /api, use relative path (proxied by Vite), 
    // or direct port 5000 if running standalone
    return endpoint;
  };

  const login = async (username, password) => {
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      // Fallback directly to backend port 5000 if proxy returned 404
      if (res.status === 404) {
        res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
      }
    } catch (netErr) {
      // Direct backend attempt if proxy network failed
      try {
        res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
      } catch {
        throw new Error('Backend server is unreachable. Please verify server is running on port 5000.');
      }
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
      let res = await fetch(url, { ...opts, headers });
      if (res.status === 404 && url.startsWith('/api')) {
        res = await fetch('http://localhost:5000' + url, { ...opts, headers });
      }
      return res;
    } catch (err) {
      try {
        if (url.startsWith('/api')) {
          return await fetch('http://localhost:5000' + url, { ...opts, headers });
        }
      } catch (_) {}
      console.warn('Network error during fetch to ' + url + ':', err.message);
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
