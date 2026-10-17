import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { canAccessRoute, getHomePath, ROUTE_PRIORITY } from '@/lib/accessControl';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

function NoAccess({ onLogout }) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-slate-100 dark:bg-slate-950">
      <div className="max-w-sm w-full text-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
        <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
        <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">Acesso não liberado</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Seu usuário ainda não tem nenhuma área liberada. Fale com a coordenação da sua unidade.
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (!canAccessRoute(user, location.pathname)) {
    // Redireciona para a primeira tela que o usuário PODE abrir; nunca para
    // a mesma tela (antes isso gerava um ciclo infinito e a tela ficava em branco).
    const preferred = getHomePath(user);
    const target = [preferred, ...ROUTE_PRIORITY].find(path => path !== location.pathname && canAccessRoute(user, path));
    return target ? <Navigate to={target} replace /> : <NoAccess onLogout={() => logout(true)} />;
  }

  return <Outlet />;
}
