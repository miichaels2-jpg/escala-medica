import { Component, Suspense, useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { persistSelectedUnit, useAppData } from '@/lib/useAppData';
import { reportAppError } from '@/lib/errorReporting';
import { supabase } from '@/lib/supabase';
import { clearStoredSession } from '@/lib/authSession';
import { listMyCompanies, switchCompany } from '@/lib/companyAccess';
import { errorInPortuguese } from '@/lib/errorText';
import { isShiftPublished } from '@/lib/sharedState';
import { 
  Activity, LayoutDashboard, CalendarDays, 
  DollarSign, Users, Building2, LogOut, Menu, X, 
  AlertTriangle, Sun, Moon, Settings, FileBarChart,
  Clock, Hospital, Bell, Flame, Smartphone,
  ListChecks, History, Globe, PlayCircle, BookOpen, Gauge, Loader2
} from 'lucide-react';
import { InstallAppBanner, InstallAppDialog } from '@/components/InstallAppGuide';
import { NotificationPanel, useNotificationCenter } from '@/components/NotificationCenter';
import { usePwaInstall } from '@/lib/pwa';
import { APP_VERSION } from '@/lib/version';
import { useUrgentVacancyAlerts } from '@/lib/useUrgentVacancyAlerts';
import { refreshPushOwner } from '@/lib/push';
import { SWITCH_UNIT_EVENT } from '@/components/UnitsOverview';
import { canAccessRoute } from '@/lib/accessControl';
import { BrandAppIcon, BrandWordmark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HelpProvider } from '@/components/help/HelpProvider';
import { applyTheme, initialTheme, saveTheme } from '@/lib/theme';

const WEEKDAYS_LONG = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

class LayoutErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Erro no Layout:', error, errorInfo);
    reportAppError('tela', error, errorInfo?.componentStack || '');
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-sm text-slate-900 dark:text-white">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Instabilidade no Módulo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 my-3">{errorInPortuguese(this.state.error?.message) || 'Erro inesperado na visualização.'}</p>
          <Button onClick={() => window.location.reload()} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs h-10 px-6 cursor-pointer">
            Recarregar Página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppLayout({ children }) {
  const { 
    user, 
    company, 
    units, 
    selectedUnitId, 
    setSelectedUnitId,
    setUnitScope,
    allUnitsView,
    isManager, 
    isBilling, 
    userAppRole,
    shifts,
    allCompanyShifts,
    allCompanyProfessionals,
    allCompanySectors,
    getPublishedRanges,
    currentProfessional,
    dataWarnings = [],
    syncGlobalData
  } = useAppData();

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const { isInstalled } = usePwaInstall();

  // Fecha o menu do celular ao trocar de tela.
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);
  const [theme, setTheme] = useState(initialTheme);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  // Dono da plataforma (Michael): vê a tela "Plataforma", com todas as empresas clientes.
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('sm_auth_is_platform_owner').then(({ data }) => { if (!cancelled) setIsPlatformOwner(data === true); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Estabelecimentos que o login abre (V0.8.1): com mais de um, aparece o seletor no topo.
  const [myCompanies, setMyCompanies] = useState([]);
  const [switchingCompany, setSwitchingCompany] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listMyCompanies().then(list => { if (!cancelled) setMyCompanies(list); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleCompanyChange = async (companyId) => {
    if (String(companyId) === String(company?.id)) return;
    setSwitchingCompany(true);
    try {
      await switchCompany(user, companyId);
      // Recarrega do zero: todos os dados passam a ser do estabelecimento escolhido.
      window.location.href = '/';
    } catch (error) {
      setSwitchingCompany(false);
      alert(error.message);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    saveTheme(nextTheme);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    clearStoredSession();
    window.location.href = '/login';
  };

  // GARANTE QUE A UNIDADE ESCOLHIDA NÃO MUDE AO TROCAR DE TELA
  const handleUnitChange = async (newUnitId, nextPath) => {
    // "Todas as unidades" só muda o modo de visão (sem recarregar a página).
    if (newUnitId === 'todas') { setUnitScope('todas'); return; }
    setSelectedUnitId(newUnitId);
    await persistSelectedUnit(user, newUnitId);
    if (nextPath) window.location.href = nextPath;
    else window.location.reload();
  };

  // "Abrir" no quadro Suas unidades (Painel) usa a mesma troca do seletor do cabeçalho.
  useEffect(() => {
    const onSwitch = event => {
      const { unitId, path } = event.detail || {};
      if (unitId && String(unitId) !== String(selectedUnitId)) handleUnitChange(String(unitId), path);
      else if (path) navigate(path);
    };
    window.addEventListener(SWITCH_UNIT_EVENT, onSwitch);
    return () => window.removeEventListener(SWITCH_UNIT_EVENT, onSwitch);
  });

  // Aparelho com avisos ativados passa a ser do usuário que está logado agora.
  useEffect(() => {
    if (!user?.id || user.id === 'usr_guest') return;
    refreshPushOwner({ userId: user.id, professionalId: currentProfessional?.id && currentProfessional.id !== 'temp_user_id' ? currentProfessional.id : '' });
  }, [user?.id, currentProfessional?.id]);

  const isPublished = shift => isShiftPublished(shift, getPublishedRanges, selectedUnitId);
  const notificationCenter = useNotificationCenter({ user, currentProfessional, shifts, companyShifts: allCompanyShifts, selectedUnitId, isManager, isPublished });
  const muralBadge = notificationCenter.unreadVacancies.length;

  // Alerta de furo iminente (vaga sem ninguém a menos de 24 h) para os profissionais compatíveis.
  useUrgentVacancyAlerts({
    enabled: Boolean(user?.id) && user.id !== 'usr_guest',
    companyId: company?.id,
    shifts: allCompanyShifts,
    professionals: allCompanyProfessionals,
    sectors: allCompanySectors,
    units,
    isPublished
  });

  const dayName = WEEKDAYS_LONG[currentTime.getDay()];
  const formattedDate = currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('pt-BR');

  const navItems = [
    { label: 'Painel', path: '/dashboard', icon: LayoutDashboard, visible: true },
    { label: 'Escala', path: '/escalas', icon: CalendarDays, visible: true },
    { label: 'Mural', path: '/trocas', icon: Flame, visible: true, badge: muralBadge },
    { label: 'Minha Escala', path: '/minha-escala', icon: Activity, visible: true },
    { label: 'Corpo Clínico', path: '/corpo-clinico', icon: Users, visible: isManager || isBilling },
    { label: 'Setores', path: '/setores', icon: Building2, visible: isManager },
    { label: 'Indicadores', path: '/indicadores', icon: Gauge, visible: isManager },
    { label: 'Relatórios', path: '/relatorios', icon: FileBarChart, visible: isManager || isBilling },
    { label: 'Faturamento', path: '/faturamento', icon: DollarSign, visible: isManager || isBilling },
    { label: 'Histórico', path: '/historico', icon: History, visible: isManager },
    { label: 'Configurações', path: '/configuracoes', icon: Settings, visible: isManager },
    { label: 'Como usar', path: '/como-usar', icon: PlayCircle, visible: true },
    { label: 'Planejamento', path: '/planejamento', icon: ListChecks, visible: isManager }, // TEMPORÁRIO
    // Só o dono da plataforma (o campo "visible" acima não filtra o menu; quem filtra é canAccessRoute).
    ...(isPlatformOwner ? [{ label: 'Plataforma', path: '/plataforma', icon: Globe, visible: true }, { label: 'Treinamento', path: '/treinamento', icon: BookOpen, visible: true }] : []),
  ].filter(item => canAccessRoute(user, item.path))
    // Plantonista: a própria agenda vem primeiro.
    .sort((a, b) => ['assistencial', 'medico'].includes(userAppRole) ? (b.path === '/minha-escala') - (a.path === '/minha-escala') : 0);

  const roleBadgeLabel = {
    gestor: 'Gestor Geral',
    manager: 'Gestor Geral',
    coordenador: 'Coordenador',
    faturamento: 'Faturamento',
    assistencial: 'Plantonista',
    medico: 'Médico'
  }[userAppRole] || 'Profissional';

  const isFieldProfessional = ['assistencial', 'medico'].includes(userAppRole);
  const selectedHospitalName = units?.find(u => String(u.id) === String(selectedUnitId))?.name || company?.name || 'Hospital Principal';

  // Mesma regra do Login: fora do administrador, só aparecem os hospitais liberados para o usuário.
  const allowedUnitIds = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
  const selectableUnits = (units || []).filter(u =>
    user?.role === 'admin' || allowedUnitIds.length === 0 ||
    allowedUnitIds.includes(String(u.id)) || String(u.id) === String(selectedUnitId)
  );

  // O plantonista vê Minha Escala e Mural de todas as unidades juntas; o seletor
  // de unidade só aparece para ele na grade de Escalas (que é por hospital).
  const professionalSeesAllUnits = isFieldProfessional && selectableUnits.length > 1;
  // No Painel, o gestor com várias unidades escolhe o escopo nos cartões da própria tela.
  const managerDashboardScope = !isFieldProfessional && selectableUnits.length > 1 && (location.pathname === '/dashboard' || location.pathname === '/');
  const showUnitSelector = !managerDashboardScope && (!professionalSeesAllUnits || location.pathname.startsWith('/escalas'));
  // Telas que sabem mostrar todas as unidades juntas oferecem essa opção no seletor.
  const screenSupportsAllUnits = !isFieldProfessional && selectableUnits.length > 1 && ['/trocas', '/historico', '/corpo-clinico', '/relatorios', '/setores', '/escalas'].includes(location.pathname);
  const headerUnitValue = screenSupportsAllUnits && allUnitsView ? 'todas' : selectedUnitId;
  // Nome mostrado no menu e no topo: segue a escolha global ("Todas" só nas telas que mostram tudo junto).
  const currentHospitalName = (managerDashboardScope || screenSupportsAllUnits) && allUnitsView
    ? `Todas as unidades (${selectableUnits.length})`
    : managerDashboardScope
      ? selectedHospitalName
      : professionalSeesAllUnits && !location.pathname.startsWith('/escalas')
      ? `Todas as suas unidades (${selectableUnits.length})`
      : selectedHospitalName;

  // Barra inferior do celular: o plantonista começa pela própria escala.
  const mobileTabs = [
    isFieldProfessional
      ? { label: 'Minha Escala', path: '/minha-escala', icon: Activity }
      : { label: 'Painel', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Escala', path: '/escalas', icon: CalendarDays },
    { label: 'Mural', path: '/trocas', icon: Flame, badge: muralBadge }
  ].filter(tab => canAccessRoute(user, tab.path));
  const mobileGridCols = ['grid-cols-2', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'][mobileTabs.length] || 'grid-cols-4';
  const userInitials = String(user?.full_name || user?.email || 'U')
    .trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <HelpProvider>
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 select-none shadow-sm print:hidden transition-colors">
        <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <BrandAppIcon size={40} />
          <div className="min-w-0">
            <h1 className="text-base text-slate-900 dark:text-white">
              <BrandWordmark />
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate">{currentHospitalName}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                    isActive || (item.path === '/dashboard' && location.pathname === '/')
                      ? 'bg-sky-600 text-white' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* PERFIL E LOGOUT */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shadow-sm">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                {user?.full_name || 'Usuário'}
              </span>
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 block truncate">
                {roleBadgeLabel}
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              title="Sair do sistema" 
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500" title="Versão do sistema">ScaleMedic {APP_VERSION}</p>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors">
        
        {/* HEADER SUPERIOR COM SELETOR DE UNIDADE BLINDADO */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] md:pt-2.5 flex items-center justify-between gap-3 sm:gap-4 shrink-0 shadow-sm z-30 print:hidden transition-colors">

          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden flex items-center gap-2.5 min-w-0">
              <BrandAppIcon size={36} />
              <div className="min-w-0 leading-tight">
                <BrandWordmark className="text-sm text-slate-900 dark:text-white block" />
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate max-w-[170px]">{currentHospitalName}</span>
              </div>
            </div>

            {myCompanies.length > 1 && <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                {switchingCompany ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" />} Estabelecimento:
              </span>
              <Select value={String(company?.id || '')} onValueChange={handleCompanyChange} disabled={switchingCompany}>
                <SelectTrigger aria-label="Estabelecimento" className="h-8 w-52 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Estabelecimento..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {myCompanies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs font-semibold cursor-pointer">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}

            {!showUnitSelector && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Hospital className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" /> {currentHospitalName}
              </span>
            )}
            {showUnitSelector && <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Hospital className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" /> Unidade:
              </span>
              <Select value={headerUnitValue} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-8 w-64 text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Selecione o Hospital..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {screenSupportsAllUnits && (
                    <SelectItem value="todas" className="text-xs font-semibold cursor-pointer">Todas as unidades ({selectableUnits.length})</SelectItem>
                  )}
                  {selectableUnits.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-xs font-semibold cursor-pointer">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs shadow-inner">
              <span className="text-slate-600 dark:text-slate-400 font-medium">
                {dayName}, {formattedDate}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="tabular-nums font-semibold text-sky-600 dark:text-cyan-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                {formattedTime}
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-all relative shadow-sm cursor-pointer"
                title="Notificações" aria-label="Notificações"
              >
                <Bell className="w-4 h-4" />
                {notificationCenter.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white tabular-nums font-semibold text-[10px] flex items-center justify-center shadow-lg shadow-rose-500/50">
                    {notificationCenter.unreadCount > 99 ? '99+' : notificationCenter.unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <NotificationPanel center={notificationCenter} isManager={isManager} onClose={() => setNotifOpen(false)} />
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all shadow-sm cursor-pointer"
              title={theme === 'dark' ? 'Alternar para Modo Diurno (Claro)' : 'Alternar para Modo Noturno (Escuro)'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {dataWarnings.length > 0 && (
          <div role="status" className="mx-4 mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 print:hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Atenção: dados incompletos ou pendentes de conferência</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {dataWarnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
                  </ul>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={syncGlobalData} className="h-8 shrink-0 border-amber-400 bg-white px-3 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800">
                Recarregar dados
              </Button>
            </div>
          </div>
        )}

        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[60] print:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in cursor-default" />
            <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white font-semibold text-sm flex items-center justify-center shrink-0 shadow-sm">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-slate-900 dark:text-white block truncate">{user?.full_name || 'Usuário'}</span>
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 block truncate">{roleBadgeLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair do sistema"
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-[10px] font-semibold">Sair</span>
              </button>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
            {myCompanies.length > 1 && <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-medium text-slate-400 mb-1 block">Estabelecimento</Label>
              <Select value={String(company?.id || '')} onValueChange={handleCompanyChange} disabled={switchingCompany}>
                <SelectTrigger aria-label="Estabelecimento" className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Estabelecimento..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {myCompanies.map(c => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs font-semibold cursor-pointer">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            {showUnitSelector && <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-medium text-slate-400 mb-1 block">Hospital Atual</Label>
              <Select value={headerUnitValue} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-10 w-full text-xs font-semibold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Selecione o Hospital..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {screenSupportsAllUnits && (
                    <SelectItem value="todas" className="text-xs font-semibold cursor-pointer">Todas as unidades ({selectableUnits.length})</SelectItem>
                  )}
                  {selectableUnits.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-xs font-semibold cursor-pointer">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
            
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-sky-600'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500 text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              {!isInstalled && (
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); setInstallGuideOpen(true); }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 cursor-pointer"
                >
                  <Smartphone className="w-5 h-5" /> Instalar aplicativo no celular
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              >
                <LogOut className="w-5 h-5" /> Sair do sistema
              </button>
              <p className="pt-1 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">ScaleMedic {APP_VERSION}</p>
            </div>
            </div>
          </div>
        )}

        <InstallAppBanner onOpenGuide={() => setInstallGuideOpen(true)} />

        <main className="flex-1 overflow-y-auto pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0">
          <LayoutErrorBoundary key={location.pathname}>
            {children || (
              <Suspense fallback={<div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-sky-600 rounded-full animate-spin" /></div>}>
                <Outlet />
              </Suspense>
            )}
          </LayoutErrorBoundary>
        </main>

        {/* BARRA INFERIOR NO CELULAR (padrão de aplicativo) */}
        <nav
          aria-label="Navegação principal"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)] print:hidden"
        >
          <div className={`grid ${mobileGridCols} h-16`}>
            {mobileTabs.map(tab => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) => `relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${isActive ? 'bg-sky-100 dark:bg-sky-500/15' : ''}`}>
                      <tab.icon className="w-5 h-5" />
                    </span>
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span className="absolute top-1.5 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                        {tab.badge > 9 ? '9+' : tab.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold cursor-pointer ${mobileMenuOpen ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
              <span className="flex items-center justify-center w-12 h-7 rounded-full">
                <Menu className="w-5 h-5" />
              </span>
              <span>Menu</span>
            </button>
          </div>
        </nav>
      </div>

      <InstallAppDialog open={installGuideOpen} onOpenChange={setInstallGuideOpen} />
    </div>
    </HelpProvider>
  );
}