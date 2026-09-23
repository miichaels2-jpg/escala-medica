import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const defaultAuthState = {
  user: null,
  isAuthenticated: false,
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  authError: null,
  appPublicSettings: { id: 'demo-local' },
  authChecked: false,
  logout: () => {},
  navigateToLogin: () => {},
  checkUserAuth: async () => {},
  checkAppState: async () => {}
};

const AuthContext = createContext(defaultAuthState);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'demo-local' });

  useEffect(() => {
    checkAppState();
  }, []);

  const fetchUserProfile = async (authUser) => {
    if (!authUser) return null;
    try {
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      return { ...authUser, ...(profile || {}) };
    } catch {
      return authUser;
    }
  };

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'demo-local' });

      let authenticatedUser = null;
      
      // 1. Tenta pegar a sessão oficial do Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          authenticatedUser = await fetchUserProfile(session.user);
        }
      } catch (err) {}

      // 2. Fallback de Segurança Inteligente: Pega a sessão local validada pela página de Login
      if (!authenticatedUser) {
        try {
          const localUserStr = window.localStorage.getItem('scale_logged_user');
          const isSessionActive = window.localStorage.getItem('escala_medica_session') === 'active';
          if (localUserStr && isSessionActive) {
            authenticatedUser = JSON.parse(localUserStr);
          }
        } catch (e) {}
      }

      if (authenticatedUser) {
        setUser(authenticatedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }

      setIsLoadingAuth(false);
      setAuthChecked(true);
      setIsLoadingPublicSettings(false);
    } catch (error) {
      setAuthError({ type: 'unknown', message: error.message || 'Erro ao verificar estado do app' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      let authenticatedUser = null;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        authenticatedUser = await fetchUserProfile(session.user);
      }

      if (!authenticatedUser) {
        const localUserStr = window.localStorage.getItem('scale_logged_user');
        const isSessionActive = window.localStorage.getItem('escala_medica_session') === 'active';
        if (localUserStr && isSessionActive) {
          authenticatedUser = JSON.parse(localUserStr);
        }
      }

      if (authenticatedUser) {
        setUser(authenticatedUser);
        setIsAuthenticated(true);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return authenticatedUser;
      }
      
      throw new Error('Sem sessão ativa');
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setIsLoadingAuth(false);
      return null;
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    window.localStorage.removeItem('scale_logged_user');
    window.localStorage.removeItem('escala_medica_session');
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, appPublicSettings, authChecked,
      logout, navigateToLogin, checkUserAuth, checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context || !context.checkAppState) {
    return defaultAuthState;
  }
  return context;
};