import React, { Component, useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppData } from '@/lib/useAppData';
import { supabase } from '@/lib/supabase';
import { 
  Activity, LayoutDashboard, CalendarDays, Repeat, 
  DollarSign, Users, Building2, LogOut, Menu, X, 
  AlertTriangle, Sun, Moon, Settings, FileBarChart,
  Clock, Hospital, Bell, Flame, CheckCircle2, ChevronRight, CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-2xl text-slate-900 dark:text-white">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-black">Instabilidade no Módulo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 my-3">{this.state.error?.message || 'Erro inesperado na visualização.'}</p>
          <Button onClick={() => window.location.reload()} className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs h-10 px-6 cursor-pointer">
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
    isManager, 
    isBilling, 
    userAppRole,
    shifts,
    currentProfessional
  } = useAppData();

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('scale_read_notifs') || '[]');
    } catch {
      return [];
    }
  });

  const [theme, setTheme] = useState('dark');
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem('hospital-intelligence-theme') || 'dark';
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('hospital-intelligence-theme', nextTheme);
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    window.localStorage.removeItem('scale_logged_user');
    window.localStorage.removeItem('escala_medica_session');
    window.location.href = '/login';
  };

  // GARANTE QUE A UNIDADE ESCOLHIDA NÃO MUDE AO TROCAR DE TELA
  const handleUnitChange = async (newUnitId) => {
    setSelectedUnitId(newUnitId);
    try {
      window.localStorage.setItem('scale_selected_unit', newUnitId);
      if (user?.id) {
        // Atualiza preferência na tabela profiles do Supabase, se aplicável
        await supabase.from('profiles').update({ selected_unit_id: newUnitId }).eq('id', user.id);
      }
    } catch (e) {
      console.error('Erro ao salvar unidade padrão', e);
    }
    window.location.reload();
  };

  const userCategory = currentProfessional?.category || (currentProfessional?.specialty?.toLowerCase().includes('enferm') ? 'enfermeiro' : 'medico');
  const todayStr = new Date().toISOString().split('T')[0];

  const rawMuralShifts = (shifts || []).filter(s => {
    const isVago = s.status === 'vago' || s.is_open === true;
    const isCancelado = String(s.status || '').toLowerCase().includes('cancel') || String(s.notes || '').toLowerCase().includes('cancel');
    if (!isVago || isCancelado) return false;
    if (s.date && s.date < todayStr) return false;

    if (String(s.unit_id) !== String(selectedUnitId)) return false;

    if (!isManager) {
      const targetCat = s.target_category || 'medico';
      if (targetCat !== userCategory) return false;
    }
    return true;
  });

  const unreadMuralShifts = rawMuralShifts.filter(s => !readNotifIds.includes(s.id));

  const handleMarkAsRead = (shiftId) => {
    const updated = [...readNotifIds, shiftId];
    setReadNotifIds(updated);
    try {
      window.localStorage.setItem('scale_read_notifs', JSON.stringify(updated));
    } catch {}
    setNotifOpen(false);
    navigate('/trocas');
  };

  const handleMarkAllAsRead = () => {
    const allIds = rawMuralShifts.map(s => s.id);
    const merged = Array.from(new Set([...readNotifIds, ...allIds]));
    setReadNotifIds(merged);
    try {
      window.localStorage.setItem('scale_read_notifs', JSON.stringify(merged));
    } catch {}
  };

  const dayName = WEEKDAYS_LONG[currentTime.getDay()];
  const formattedDate = currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedTime = currentTime.toLocaleTimeString('pt-BR');

  const navItems = [
    { label: 'Painel Geral', path: '/dashboard', icon: LayoutDashboard, visible: true },
    { label: 'Escalas & Plantões', path: '/escalas', icon: CalendarDays, visible: true },
    { label: 'Mural de Oportunidades', path: '/trocas', icon: Flame, visible: true, badge: unreadMuralShifts.length },
    { label: 'Minha Escala', path: '/minha-escala', icon: Activity, visible: true },
    { label: 'Corpo Clínico', path: '/corpo-clinico', icon: Users, visible: isManager || isBilling },
    { label: 'Setores & Especialidades', path: '/setores', icon: Building2, visible: isManager },
    { label: 'Relatórios', path: '/relatorios', icon: FileBarChart, visible: isManager || isBilling },
    { label: 'Faturamento & Repasse', path: '/faturamento', icon: DollarSign, visible: isManager || isBilling },
    { label: 'Configurações', path: '/configuracoes', icon: Settings, visible: isManager },
  ].filter(item => item.visible);

  const roleBadgeLabel = {
    gestor: 'Gestor Geral',
    coordenador: 'Coordenador',
    faturamento: 'Faturamento',
    assistencial: 'Plantonista',
    medico: 'Médico'
  }[userAppRole] || 'Profissional';

  const currentHospitalName = units?.find(u => String(u.id) === String(selectedUnitId))?.name || company?.name || 'Hospital Principal';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 select-none shadow-xl print:hidden transition-colors">
        <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0 ring-1 ring-white/20">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1">
              ScaleMedic <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-mono">PRO</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold truncate">{currentHospitalName}</p>
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
                  `flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive || (item.path === '/dashboard' && location.pathname === '/')
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-600/30' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
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
              <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
                {user?.full_name || 'Usuário'}
              </span>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block truncate">
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
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 dark:bg-slate-950 transition-colors">
        
        {/* HEADER SUPERIOR COM SELETOR DE UNIDADE BLINDADO */}
        <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-sm z-30 print:hidden transition-colors">
          
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-black text-sm text-slate-900 dark:text-white">ScaleMedic</span>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Hospital className="w-3.5 h-3.5 text-sky-600 dark:text-sky-500" /> Unidade:
              </span>
              <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-8 w-64 text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Selecione o Hospital..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {units.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-xs font-bold cursor-pointer">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs shadow-inner">
              <span className="text-slate-600 dark:text-slate-400 font-bold">
                {dayName}, {formattedDate}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-mono font-black text-sky-600 dark:text-cyan-400 flex items-center gap-1.5 tracking-wider">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                {formattedTime}
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-all relative shadow-sm cursor-pointer"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {unreadMuralShifts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-mono font-black text-[10px] flex items-center justify-center animate-bounce shadow-lg shadow-rose-500/50">
                    {unreadMuralShifts.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-black uppercase text-slate-900 dark:text-white">Central de Vagas</span>
                    </div>
                    {unreadMuralShifts.length > 0 && (
                      <button 
                        onClick={handleMarkAllAsRead} 
                        className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" /> Limpar todas
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {unreadMuralShifts.length === 0 ? (
                      <div className="text-center py-6 space-y-1">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-80" />
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Nenhuma notificação pendente</p>
                        <p className="text-[11px] text-slate-500">Você já visualizou todas as vagas abertas.</p>
                      </div>
                    ) : (
                      unreadMuralShifts.map(shift => (
                        <div 
                          key={shift.id} 
                          onClick={() => handleMarkAsRead(shift.id)}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer space-y-1 group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Flame className="w-3 h-3" /> Vaga Disponível
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{shift.date}</span>
                          </div>
                          <p className="text-xs font-black text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors">
                            Plantão {shift.shift_type === 'diurno' ? '07h às 19h' : '19h às 07h'}
                          </p>
                          <span className="text-[10px] text-slate-500 block">Clique para assumir este plantão no Mural.</span>
                        </div>
                      ))
                    )}
                  </div>

                  <Button 
                    size="sm" 
                    onClick={() => { setNotifOpen(false); navigate('/trocas'); }}
                    className="w-full h-8 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl cursor-pointer"
                  >
                    Ir para o Mural de Oportunidades <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
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
              className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 space-y-2 z-50 shadow-2xl print:hidden">
            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Hospital Atual</Label>
              <Select value={selectedUnitId} onValueChange={handleUnitChange}>
                <SelectTrigger className="h-10 w-full text-xs font-black bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 rounded-xl cursor-pointer">
                  <SelectValue placeholder="Selecione o Hospital..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 z-[99999]">
                  {units.map(u => (
                    <SelectItem key={u.id} value={String(u.id)} className="text-xs font-bold cursor-pointer">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-sky-600" />
                  <span>{item.label}</span>
                </div>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <LayoutErrorBoundary>
            {children || <Outlet />}
          </LayoutErrorBoundary>
        </main>
      </div>
    </div>
  );
}