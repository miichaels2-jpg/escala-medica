import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { USER_PUBLIC_COLUMNS } from '@/lib/useAppData';
import { clearStoredSession, resolveSignedInUser } from '@/lib/authSession';

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
    // Sessão oficial encerrada (expirou ou foi revogada) com o app aberto: volta ao login.
    // Sem chamadas ao Supabase aqui dentro (o aviso chega com a trava da sessão ainda presa).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      if (window.localStorage.getItem('escala_medica_session') !== 'active') return;
      clearStoredSession();
      window.location.href = '/login';
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'demo-local' });

      let authenticatedUser = null;
      
      // Só entra quem tem a sessão oficial (o banco não responde sem ela).
      authenticatedUser = await resolveSignedInUser(USER_PUBLIC_COLUMNS);

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
      
      authenticatedUser = await resolveSignedInUser(USER_PUBLIC_COLUMNS);

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
    clearStoredSession();
    try {
      await supabase.auth.signOut();
    } catch {}
    
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