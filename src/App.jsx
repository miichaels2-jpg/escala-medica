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
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Escalas from '@/pages/Escalas';
import CorpoClinico from '@/pages/CorpoClinico';
import Setores from '@/pages/Setores';
import Relatorios from '@/pages/Relatorios';
import Faturamento from '@/pages/Faturamento';
import Configuracoes from '@/pages/Configuracoes';
import MinhaEscala from '@/pages/MinhaEscala';
import Trocas from '@/pages/Trocas';
import MobilePreview from '@/pages/MobilePreview';

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

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
    <Routes>
      {/* Se já estiver logado e tentar abrir a raiz, vai pro dashboard. Se não, abre o Login/Home */}
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />

      {/* Rotas Públicas */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mobile-preview" element={<MobilePreview />} />

      {/* Rotas Protegidas (se deslogado, vai para /) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/" replace />} />}>
        <Route element={<AppLayout />}>
          {/* Suporta tanto /dashboard quanto / para não quebrar cliques no menu */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/escalas" element={<Escalas />} />
          <Route path="/corpo-clinico" element={<CorpoClinico />} />
          <Route path="/setores" element={<Setores />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/faturamento" element={<Faturamento />} />
          <Route path="/minha-escala" element={<MinhaEscala />} />
          <Route path="/trocas" element={<Trocas />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
      </Route>

      {/* Rota 404 */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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