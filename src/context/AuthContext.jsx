import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const data = await api.getProfile();
        if (data && !data.error) {
           setUser(data); 
        }
      } catch (e) {
        console.error("Profile refresh failed", e);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        await refreshUser();
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password);
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (err) {
      return { success: false, error: 'Connection error' };
    }
  };

  const loginWithFirebase = async (firebaseToken) => {
    try {
      const data = await api.loginFirebase(firebaseToken);
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: data.error || 'Firebase Login failed' };
    } catch (err) {
      return { success: false, error: 'Connection error' };
    }
  };

  const register = async (regData) => {
    try {
      const data = await api.register(regData);
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        await refreshUser();
        return { success: true };
      }
      return { success: false, error: data.error || 'Registration failed' };
    } catch (err) {
      return { success: false, error: 'Connection error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('profile_picture');
    setUser(null);
  };

  const setTermsAccepted = () => {
    setUser(prev => prev ? { ...prev, terms_accepted: 1 } : null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, login, loginWithFirebase, register, logout, 
      isAdmin: user?.role === 'admin', 
      isTermsAccepted: !!user?.terms_accepted,
      setTermsAccepted,
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
