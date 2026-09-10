import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import NotificationBell from '@/components/NotificationBell';
import {
  Activity, Calendar, Users, Layers, BarChart2, DollarSign, Repeat,
  Settings, LogOut, Menu, X, Stethoscope, ChevronDown
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: BarChart2 },
  { to: '/escalas', label: 'Escalas & Plantões', icon: Calendar },
  { to: '/trocas', label: 'Trocas de Plantão', icon: Repeat },
  { to: '/corpo-clinico', label: 'Corpo Clínico', icon: Users },
  { to: '/setores', label: 'Setores & Especialidades', icon: Layers },
  { to: '/relatorios', label: 'Relatórios & Horas', icon: BarChart2 },
  { to: '/faturamento', label: 'Faturamento & Repasse', icon: DollarSign },
  { to: '/minha-escala', label: 'Minha Escala (App)', icon: Stethoscope },
  { to: '/configuracoes', label: 'Configurações Empresa', icon: Settings },
];

const pageTitles = {
  '/': 'Dashboard',
  '/escalas': 'Gestão de Escalas',
  '/trocas': 'Trocas de Plantão',
  '/corpo-clinico': 'Corpo Clínico',
  '/setores': 'Setores & Especialidades',
  '/relatorios': 'Relatórios & Horas',
  '/faturamento': 'Faturamento & Repasse',
  '/minha-escala': 'Minha Escala',
  '/configuracoes': 'Configurações da Empresa',
};

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppLayout() {
  const { user, company, loading } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const roleLabel = isAdmin ? 'Administrador' : (user?.data?.app_role === 'manager' ? 'Gestor' : 'Profissional');
  const title = pageTitles[location.pathname] || 'ScaleMedic CGT';

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-5 py-6 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">ScaleMedic CGT</span>
      </div>

      {company && (
        <div className="mx-3 mt-3 mb-2 px-3 py-2.5 rounded-lg bg-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-sky-300 font-medium truncate flex items-center gap-1.5">
            🏥 {company.name}
          </span>
          <span className="text-[10px] bg-sky-500 text-white px-1.5 py-0.5 rounded font-semibold uppercase">
            {roleLabel}
          </span>
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Sair
        </button>
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex-col bg-slate-900 flex">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-slate-600"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-800">{title}</h1>
              {company && (
                <p className="text-xs text-slate-500 hidden sm:block">
                  {company.name} · {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg p-1 pr-2 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sm font-semibold text-sky-700">
                {getInitials(user?.full_name || user?.email)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-semibold text-slate-800 leading-tight">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-xs text-slate-500">{roleLabel}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-20 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/configuracoes'); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Configurações
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Sair da conta
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}