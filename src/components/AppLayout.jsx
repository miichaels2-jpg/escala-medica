import { useEffect, useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import NotificationBell from '@/components/NotificationBell';
import {
  Activity, Calendar, Users, Layers, BarChart2, DollarSign, Repeat, Clock3,
  Settings, LogOut, Menu, X, Stethoscope, ChevronDown, Moon, SunMedium, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Painel', icon: BarChart2 },
  { to: '/escalas', label: 'Escalas e plantões', icon: Calendar },
  { to: '/trocas', label: 'Trocas de plantão', icon: Repeat },
  { to: '/corpo-clinico', label: 'Cadastro de profissional', icon: Users },
  { to: '/setores', label: 'Setores e especialidades', icon: Layers },
  { to: '/relatorios', label: 'Relatórios e horas', icon: BarChart2 },
  { to: '/faturamento', label: 'Faturamento e repasse', icon: DollarSign },
  { to: '/minha-escala', label: 'Minha escala', icon: Stethoscope },
  { to: '/configuracoes', label: 'Configurações da empresa', icon: Settings },
];

const professionalNavItems = [
  { to: '/dashboard', label: 'Painel', icon: BarChart2 },
  { to: '/escalas', label: 'Minha escala', icon: Calendar },
  { to: '/trocas', label: 'Trocas', icon: Repeat },
  { to: '/minha-escala', label: 'Agenda pessoal', icon: Stethoscope },
];

const pageTitles = {
  '/dashboard': 'Painel',
  '/escalas': 'Gestão de escalas',
  '/trocas': 'Trocas de plantão',
  '/corpo-clinico': 'Cadastro de profissional',
  '/setores': 'Setores e especialidades',
  '/relatorios': 'Relatórios e horas',
  '/faturamento': 'Faturamento e repasse',
  '/minha-escala': 'Minha escala',
  '/configuracoes': 'Configurações da empresa',
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('medscale-sidebar-collapsed') === 'true');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('medscale-theme');
    return stored ? stored : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    localStorage.setItem('medscale-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('medscale-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isManager = isAdmin || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';
  const userPermissions = Array.isArray(user?.data?.permissions) ? user.data.permissions : [];
  
  const navList = (isManager ? navItems : professionalNavItems).filter((item) => {
    if (isManager) return true;
    const permissionMap = {
      '/dashboard': 'dashboard',
      '/escalas': 'escalas',
      '/trocas': 'trocas',
      '/minha-escala': 'escalas',
      '/corpo-clinico': 'corpo_clinico',
      '/relatorios': 'relatorios',
      '/faturamento': 'faturamento',
      '/configuracoes': 'configuracoes'
    };
    const requiredPermission = permissionMap[item.to];
    if (!requiredPermission) return true;
    return userPermissions.length === 0 || userPermissions.includes(requiredPermission);
  });

  // Filtra as unidades disponíveis com base no perfil do usuário
  const availableUnits = useMemo(() => {
    if (!company?.units) return [];
    if (isManager) return company.units;

    // Se for profissional comum, filtra somente as unidades atribuídas a ele
    const userUnitIds = Array.isArray(user?.data?.unit_ids) 
      ? user.data.unit_ids 
      : (user?.data?.selected_unit_id ? [user.data.selected_unit_id] : []);

    if (userUnitIds.length > 0) {
      const allowed = company.units.filter((u) => userUnitIds.includes(u.id));
      return allowed.length > 0 ? allowed : company.units.slice(0, 1);
    }

    return company.units.slice(0, 1);
  }, [company?.units, isManager, user?.data]);

  const selectedUnitId = user?.data?.selected_unit_id || availableUnits[0]?.id || company?.selected_unit_id;
  const selectedUnit = availableUnits.find((unit) => unit.id === selectedUnitId) || availableUnits[0] || company?.units?.[0] || null;
  
  const title = isManager 
    ? (pageTitles[location.pathname] || 'ScaleMedic CGT') 
    : (location.pathname === '/escalas' ? 'Minha escala' : (location.pathname === '/minha-escala' ? 'Agenda pessoal' : 'Painel do profissional'));

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const handleSelectUnit = async (nextUnitId) => {
    if (!company || !nextUnitId) return;
    try {
      await base44.entities.Company.update(company.id, { selected_unit_id: nextUnitId, units: company.units || [] });
      await base44.auth.updateMe({ data: { selected_unit_id: nextUnitId } });
      window.location.reload();
    } catch (error) {
      alert(error.message || 'Não foi possível trocar de unidade.');
    }
  };

  const SidebarContent = () => (
    <>
      <div className={`flex items-center gap-2.5 border-b border-slate-800 py-6 ${sidebarCollapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="w-9 h-9 rounded-lg bg-sky-500 flex items-center justify-center">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && <span className="text-xl font-bold text-white tracking-tight">ScaleMedic CGT</span>}
      </div>

      {company && !sidebarCollapsed && (
        <div className="mx-3 mt-3 mb-2 px-3 py-2.5 rounded-lg bg-slate-800/60">
          <div className="flex items-center gap-2 min-w-0">
            {company.logo_url && (
              <img src={company.logo_url} alt={company.name} className="w-8 h-8 rounded-md object-cover border border-slate-700" />
            )}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Hospital</div>
              <span className="text-xs text-sky-300 font-medium truncate block">
                {selectedUnit?.name || company.name}
              </span>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navList.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
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
              {!sidebarCollapsed && item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!sidebarCollapsed && 'Sair'}
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
    <div className="flex h-screen bg-slate-50 dark:bg-[#0d1320] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`relative hidden md:flex flex-col bg-[#111827] dark:bg-[#0b1220] flex-shrink-0 border-r border-slate-800 transition-all duration-200 ${sidebarCollapsed ? 'w-[72px]' : 'w-64'}`}>
        <SidebarContent />
        <button
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
          className="absolute -right-4 top-1/2 z-50 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-slate-200 shadow-lg transition hover:bg-sky-700"
          aria-label={sidebarCollapsed ? 'Mostrar menu lateral' : 'Ocultar menu lateral'}
          title={sidebarCollapsed ? 'Mostrar menu lateral' : 'Ocultar menu lateral'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
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
        <header className="relative z-40 bg-white/90 dark:bg-[#101a2b]/90 border-b border-slate-200 dark:border-slate-700/80 px-4 md:px-8 py-4 flex items-center justify-between flex-shrink-0 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-slate-600"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
              {company && (
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  {selectedUnit?.name || company.name} · {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/90">
              <Clock3 className="h-4 w-4 text-sky-600 dark:text-sky-300" />
              <div className="leading-tight">
                <div className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-100">
                  {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="text-[10px] capitalize text-slate-500 dark:text-slate-400">
                  {currentTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')}
                </div>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Alternar tema"
            >
              {theme === 'dark' ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            
            <NotificationBell />
            
            {/* O seletor só aparece se o usuário for gestor e houver mais de uma unidade, ou se o profissional tiver mais de uma autorizada */}
            {availableUnits.length > 1 && isManager && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Unidade</span>
                <select
                  value={selectedUnitId || ''}
                  onChange={(e) => handleSelectUnit(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {availableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative z-[60]">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg p-1 pr-2 transition-colors dark:hover:bg-slate-800"
              >
                <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sm font-semibold text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                  {getInitials(user?.full_name || user?.email)}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800 leading-tight dark:text-slate-100">
                    {user?.full_name || user?.email}
                  </div>
                  {selectedUnit && <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUnit.name}</div>}
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block dark:text-slate-300" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 dark:border-slate-700 dark:bg-slate-900">
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/configuracoes'); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Configurações
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-slate-800"
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