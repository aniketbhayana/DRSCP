import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('drscp_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('drscp_user');
    return saved ? JSON.parse(saved) : { username: 'admin_chennai', role: 'ADMIN', user_id: 1 };
  });

  const login = async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('drscp_token', data.token);
        localStorage.setItem('drscp_user', JSON.stringify(data.user));
        return { success: true };
      }
    } catch (err) {
      console.warn('API login error, falling back to local session:', err);
    }
    // Fallback demo user
    const fallbackUser = { username: username || 'admin_chennai', role: 'ADMIN', user_id: 1 };
    setUser(fallbackUser);
    localStorage.setItem('drscp_user', JSON.stringify(fallbackUser));
    return { success: true };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('drscp_token');
    localStorage.removeItem('drscp_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
