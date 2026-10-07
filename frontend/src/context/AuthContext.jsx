import React, { createContext, useState, useContext, useCallback } from 'react';

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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
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
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return fetch(url, { ...opts, headers });
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
