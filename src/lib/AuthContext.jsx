
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef
} from 'react';

import { supabase } from '@/lib/supabase';

const defaultAuthState = {
  user: null,
  isAuthenticated: false,
  isLoadingAuth: true,
  isLoadingPublicSettings: false,
  authError: null,
  appPublicSettings: { id: 'demo-local' },
  authChecked: false,
  logout: async () => {},
  navigateToLogin: () => {},
  checkUserAuth: async () => null,
  checkAppState: async () => {}
};

const AuthContext = createContext(defaultAuthState);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: 'demo-local'
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateAuthState = useCallback((nextUser) => {
    if (!mountedRef.current) return;

    setUser(nextUser || null);
    setIsAuthenticated(!!nextUser);
    setAuthChecked(true);
  }, []);

  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser?.id) return null;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        'Erro ao buscar perfil do usuário:',
        profileError
      );

      // Não interrompe o login somente porque o perfil
      // complementar não foi encontrado.
      return {
        ...authUser,
        profile_missing: true
      };
    }

    return {
      ...authUser,
      ...(profile || {}),
      profile_missing: !profile
    };
  }, []);

  const checkUserAuth = useCallback(async () => {
    if (mountedRef.current) {
      setIsLoadingAuth(true);
      setAuthError(null);
    }

    try {
      const {
        data: { user: authUser },
        error: authError
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authUser) {
        updateAuthState(null);
        return null;
      }

      const fullUser = await fetchUserProfile(authUser);

      updateAuthState(fullUser);

      return fullUser;
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);

      if (mountedRef.current) {
        setAuthError({
          type: 'auth',
          message: error?.message || 'Erro ao verificar autenticação.'
        });
      }

      updateAuthState(null);

      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoadingAuth(false);
      }
    }
  }, [fetchUserProfile, updateAuthState]);

  const checkAppState = useCallback(async () => {
    if (mountedRef.current) {
      setIsLoadingAuth(true);
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: 'demo-local' });
    }

    try {
      await checkUserAuth();
    } catch (error) {
      console.error('Erro ao inicializar o aplicativo:', error);

      if (mountedRef.current) {
        setAuthError({
          type: 'unknown',
          message: error?.message || 'Erro ao inicializar o aplicativo.'
        });
      }

      updateAuthState(null);
    } finally {
      if (mountedRef.current) {
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        setAuthChecked(true);
      }
    }
  }, [checkUserAuth, updateAuthState]);

  // Inicializa o estado do aplicativo
  useEffect(() => {
    checkAppState();
  }, [checkAppState]);

  // Mantém o contexto sincronizado com o Supabase Auth
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      // Logout ou sessão encerrada
      if (!session?.user) {
        updateAuthState(null);
        setIsLoadingAuth(false);
        return;
      }

      // Login, inicialização e renovação de sessão
      if (
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        // Evita operações de rede adicionais durante
        // o callback do Supabase Auth.
        setIsLoadingAuth(true);

        try {
          const fullUser = await fetchUserProfile(session.user);

          updateAuthState(fullUser);
        } catch (error) {
          console.error(
            'Erro ao atualizar perfil durante evento de autenticação:',
            error
          );

          updateAuthState(session.user);
        } finally {
          if (mountedRef.current) {
            setIsLoadingAuth(false);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, updateAuthState]);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Erro ao encerrar sessão:', error);
      }
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
    }

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};