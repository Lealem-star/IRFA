import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('irfa_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('irfa_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (res.data.success && res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('irfa_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.error('Session validation error:', err);
        localStorage.removeItem('irfa_token');
        localStorage.removeItem('irfa_user');
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      const { token: receivedToken, user: receivedUser } = res.data;
      localStorage.setItem('irfa_token', receivedToken);
      localStorage.setItem('irfa_user', JSON.stringify(receivedUser));
      setToken(receivedToken);
      setUser(receivedUser);
    } else {
      throw new Error(res.data.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore
    } finally {
      localStorage.removeItem('irfa_token');
      localStorage.removeItem('irfa_user');
      setUser(null);
      setToken(null);
      window.location.href = '/login';
    }
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  };

  const updateUser = (updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedFields };
      localStorage.setItem('irfa_user', JSON.stringify(merged));
      return merged;
    });
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('irfa_user', JSON.stringify(res.data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasRole, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
