import React, { Component, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/apiClient';
import { 
  Activity, LayoutDashboard, CalendarDays, Repeat, 
  DollarSign, Users, Building2, LogOut, Menu, X, 
  AlertTriangle, ShieldCheck, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Blindagem contra tela branca em qualquer tela do sistema
class LayoutErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Erro na renderização:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Instabilidade ao carregar este módulo</h2>
          <p className="text-xs text-slate-500 my-3">{this.state.error?.message || 'Erro inesperado na visualização.'}</p>
          <Button onClick={() => window.location.reload()} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-6">
            Recarregar Página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppLayout({ children }) {
  const { user, company, units, selectedUnitId, setSelectedUnitId, isManager } = useAppData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (base44?.auth?.logout) {
        await base44.auth.logout();
      }
    } catch (e) {}
    window.localStorage.removeItem('scale_logged_user');
    window.location.href = '/login';
  };

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: LayoutDashboard },
    { label: 'Escalas & Plantões', path: '/escalas', icon: CalendarDays },
    { label: 'Trocas & Mural', path: '/trocas', icon: Repeat },
    { label: 'Minha Escala', path: '/minha-escala', icon: Activity },
    { label: 'Faturamento & Repasse', path: '/faturamento', icon: DollarSign },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0">
        <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900 dark:text-white truncate">ScaleMedic</h1>
            <p className="text-[10px] text-slate-400 font-bold truncate">{company?.name || 'Hospital Principal'}</p>
          </div>
        </div>

        {/* NAVEGAÇÃO */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* PERFIL E LOGOUT */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-slate-900 dark:text-white block truncate">
                {user?.full_name || 'Usuário'}
              </span>
              <span className="text-[9px] text-slate-400 uppercase font-black block">
                {isManager ? 'Gestor Master' : 'Profissional'}
              </span>
            </div>
            <button onClick={handleLogout} title="Sair do sistema" className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* BARRA SUPERIOR MOBILE */}
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-black text-sm text-slate-900 dark:text-white">ScaleMedic</span>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600 dark:text-slate-300">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* MENU MOBILE EXPANDIDO */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 space-y-2 z-50 shadow-xl">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <item.icon className="w-4 h-4 text-sky-600" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <div className="pt-2 border-t">
              <Button onClick={handleLogout} variant="outline" className="w-full text-xs text-rose-500 border-rose-200">
                Sair do Sistema
              </Button>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA PÁGINA COM ERROR BOUNDARY */}
        <main className="flex-1 overflow-y-auto">
          <LayoutErrorBoundary>
            {children || <Outlet />}
          </LayoutErrorBoundary>
        </main>
      </div>
    </div>
  );
}