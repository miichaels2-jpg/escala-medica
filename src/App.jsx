import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import AppLayout from '@/components/AppLayout';
import { lazyPage } from '@/lib/lazyPage';
import AutoLogout from '@/components/AutoLogout'; 
import ContractGuard from '@/components/ContractGuard';
import { getHomePath } from '@/lib/accessControl';

// Cada tela vira um arquivo separado, baixado só quando é aberta.
const Register = lazyPage(() => import('@/pages/Register'));
const TermosDeUso = lazyPage(() => import('./pages/TermosDeUso'));
const Dashboard = lazyPage(() => import('@/pages/Dashboard'));
const Escalas = lazyPage(() => import('@/pages/Escalas'));
const CorpoClinico = lazyPage(() => import('@/pages/CorpoClinico'));
const Setores = lazyPage(() => import('@/pages/Setores'));
const Relatorios = lazyPage(() => import('@/pages/Relatorios'));
const Indicadores = lazyPage(() => import('@/pages/Indicadores'));
const Faturamento = lazyPage(() => import('@/pages/Faturamento'));
const Configuracoes = lazyPage(() => import('@/pages/Configuracoes'));
const MinhaEscala = lazyPage(() => import('@/pages/MinhaEscala'));
const Trocas = lazyPage(() => import('@/pages/Trocas'));
const ComoUsar = lazyPage(() => import('@/pages/ComoUsar'));
const Planejamento = lazyPage(() => import('@/pages/Planejamento')); // TEMPORÁRIO
const Plataforma = lazyPage(() => import('@/pages/Plataforma'));
const Treinamento = lazyPage(() => import('@/pages/Treinamento'));
const Historico = lazyPage(() => import('@/pages/Historico'));

const PageLoading = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-sky-600 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();

  // O plantonista entra direto na própria agenda; gestores seguem para o Painel.
  const homePath = getHomePath(user);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <>
      {isAuthenticated && <AutoLogout timeoutMinutes={60} />}

      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to={homePath} replace /> : <Login />} 
        />

        <Route path="/login" element={isAuthenticated ? <Navigate to={homePath} replace /> : <Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/termos-de-uso" element={<TermosDeUso />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/" replace />} />}>
          <Route element={<ContractGuard><AppLayout /></ContractGuard>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/escalas" element={<Escalas />} />
            <Route path="/corpo-clinico" element={<CorpoClinico />} />
            <Route path="/setores" element={<Setores />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/indicadores" element={<Indicadores />} />
            <Route path="/faturamento" element={<Faturamento />} />
            <Route path="/minha-escala" element={<MinhaEscala />} />
            <Route path="/trocas" element={<Trocas />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/como-usar" element={<ComoUsar />} />
            <Route path="/planejamento" element={<Planejamento />} /> {/* TEMPORÁRIO */}
            <Route path="/plataforma" element={<Plataforma />} />
            <Route path="/treinamento" element={<Treinamento />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;