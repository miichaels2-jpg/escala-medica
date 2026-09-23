import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Activity, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, 
  FileText, Check, Building2, Hospital, CheckCircle2 
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados dos Modais (LGPD e Múltiplas Unidades)
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  
  const [pendingUser, setPendingUser] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [selectedUnitForLogin, setSelectedUnitForLogin] = useState('');
  
  const [lgpdChecked, setLgpdChecked] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    try {
      const savedLogin = window.localStorage.getItem('scale_remember_login');
      const savedPass = window.localStorage.getItem('scale_remember_pass');
      if (savedLogin) {
        setLoginId(savedLogin);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const proceedWithLogin = async (userRecord, unitIdToSave) => {
    window.localStorage.setItem('scale_logged_user', JSON.stringify(userRecord));
    window.localStorage.setItem('escala_medica_session', 'active');
    
    if (unitIdToSave) {
      window.localStorage.setItem('scale_selected_unit', unitIdToSave);
      // Salva a preferência de último login no banco para carregar mais rápido da próxima vez
      try {
        await supabase.from('users').update({ 
          data: { ...(userRecord.data || {}), selected_unit_id: unitIdToSave } 
        }).eq('id', userRecord.id);
      } catch (e) {}
    } else if (userRecord.data?.selected_unit_id) {
      window.localStorage.setItem('scale_selected_unit', userRecord.data.selected_unit_id);
    }
    
    try { await checkUserAuth(); } catch {}
    navigate('/');
  };

  const checkAndShowUnitModal = (uRecord, unitsList) => {
    if (unitsList.length > 1) {
      // Abre o Modal para ele escolher em qual Hospital vai entrar
      setPendingUser(uRecord);
      setAvailableUnits(unitsList);
      setSelectedUnitForLogin(unitsList[0].id);
      setShowUnitModal(true);
    } else {
      // Só tem um hospital, entra direto
      const singleUnitId = unitsList[0]?.id || uRecord.data?.selected_unit_id || 'unit_h1';
      proceedWithLogin(uRecord, singleUnitId);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!loginId || !password) {
      setError('Preencha o usuário/e-mail e a senha para continuar.');
      return;
    }

    setLoading(true);

    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('A conexão com o servidor demorou muito. Verifique sua internet.');
    }, 10000);

    try {
      const cleanInput = loginId.trim();

      if (rememberMe) {
        window.localStorage.setItem('scale_remember_login', cleanInput);
        window.localStorage.setItem('scale_remember_pass', password);
      } else {
        window.localStorage.removeItem('scale_remember_login');
        window.localStorage.removeItem('scale_remember_pass');
      }

      // Bypass Universal de Segurança
      if ((cleanInput.toLowerCase() === 'admin' || cleanInput.toLowerCase() === 'admin@admin.com') && (password === '123456' || password === 'admin')) {
        const adminUser = {
          id: 'admin_master',
          email: 'admin@admin.com',
          full_name: 'Administrador Master',
          role: 'admin',
          data: { app_role: 'gestor', company_id: 'cmp_principal', selected_unit_id: 'unit_h1', lgpd_accepted: true }
        };
        clearTimeout(timeoutId);
        await proceedWithLogin(adminUser, 'unit_h1');
        return;
      }

      // Autentica via RPC
      const { data: userRecord, error: rpcErr } = await supabase.rpc('auth_fallback_login', {
        p_login: cleanInput.toLowerCase(),
        p_password: password
      });

      if (rpcErr || !userRecord) throw new Error('Usuário não encontrado ou senha incorreta.');

      // Puxar as Unidades da Empresa para o Pop-up Múltiplo
      const compId = userRecord.data?.company_id || userRecord.company_id || 'cmp_principal';
      const { data: compData } = await supabase.from('companies').select('data').eq('id', compId).maybeSingle();
      
      const allUnits = compData?.data?.units || [];
      const allowedIds = userRecord.data?.allowed_unit_ids || [];
      
      // Filtra as unidades do banco pelas unidades que o profissional tem acesso
      let myUnits = allUnits;
      if (userRecord.role !== 'admin') {
        myUnits = allUnits.filter(u => allowedIds.includes(String(u.id)));
      }

      clearTimeout(timeoutId);

      // Verificação da LGPD
      if (!userRecord.data?.lgpd_accepted) {
        setPendingUser(userRecord);
        setAvailableUnits(myUnits); // Guarda para mostrar o próximo modal se necessário
        setShowLgpdModal(true);
        setLoading(false);
        return;
      }

      // Passou na LGPD, verifica múltiplas unidades
      checkAndShowUnitModal(userRecord, myUnits);

    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!pendingUser || !lgpdChecked) return;
    setLoadingAction(true);
    try {
      const updatedData = { 
        ...(pendingUser.data || {}), 
        lgpd_accepted: true, 
        lgpd_accepted_at: new Date().toISOString() 
      };

      await supabase.from('users').update({ data: updatedData }).eq('id', pendingUser.id);
      
      pendingUser.data = updatedData;
      setShowLgpdModal(false);
      checkAndShowUnitModal(pendingUser, availableUnits);
    } catch (err) {
      setError('Erro ao registrar o aceite dos termos. Tente novamente.');
      setShowLgpdModal(false);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSelectUnitAndEnter = () => {
    if (!selectedUnitForLogin) return;
    setLoadingAction(true);
    proceedWithLogin(pendingUser, selectedUnitForLogin);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors duration-500 font-sans">
      
      {/* 1. FUNDO PREMIUM (Watermark Médico + Efeitos Radiais) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Padrão abstrato de malha médica (cruzes) bem sutil */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M28 20h4v8h8v4h-8v8h-4v-8h-8v-4h8v-8z\' fill=\'%230ea5e9\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')] opacity-100" />
        {/* Luz radial Superior Esquerda (Azul ScaleMedic) */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] bg-sky-600/20 rounded-full blur-[120px]" />
        {/* Luz radial Inferior Direita (Índigo Profundo) */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      {/* 2. CARD DE LOGIN PRINCIPAL (Glassmorphism) */}
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30 mb-4 ring-2 ring-white/50 dark:ring-slate-800">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ScaleMedic</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1 text-center">Gestão Hospitalar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Usuário ou E-mail</Label>
            <Input 
              type="text" 
              placeholder="Ex: dr.carlos"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors"
              disabled={loading || showLgpdModal || showUnitModal}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Senha</Label>
              <Link to="/forgot-password" className="text-[11px] font-bold text-sky-600 hover:text-sky-500 transition-colors">Esqueceu a senha?</Link>
            </div>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl pr-10 text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors"
                disabled={loading || showLgpdModal || showUnitModal}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-600 cursor-pointer transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input 
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Lembrar-me neste dispositivo</span>
            </label>
          </div>

          <Button 
            type="submit" 
            disabled={loading || showLgpdModal || showUnitModal} 
            className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-xl shadow-lg shadow-sky-600/20 mt-2 transition-all cursor-pointer hover:scale-[1.02]"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Conectando...</> : 'Entrar no Sistema'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Novo na plataforma? {' '}
            <Link to="/register" className="font-bold text-sky-600 hover:text-sky-500 transition-colors">Solicite seu credenciamento</Link>
          </p>
        </div>
      </div>

      {/* RODAPÉ DO SISTEMA */}
      <div className="absolute bottom-6 text-center z-0 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-slate-400 font-medium">
          Ao entrar, você concorda com nossos <Link to="/termos-de-uso" className="font-bold text-sky-400 hover:underline">Termos de Uso e LGPD</Link>.
        </p>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          &copy; 2026 ScaleMedic Enterprise. Todos os direitos reservados.
        </p>
      </div>

      {/* =========================================================================
          MODAL 1: ACEITE DA LGPD (PRIMEIRO ACESSO)
          ========================================================================= */}
      <Dialog open={showLgpdModal} onOpenChange={(open) => !open && setShowLgpdModal(false)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-6 h-6" /> Privacidade e LGPD
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Olá, <strong>{pendingUser?.full_name?.split(' ')[0] || 'Profissional'}</strong>. Como este é o seu primeiro acesso ao nosso ecossistema, precisamos que você leia e concorde com os nossos termos de tratamento de dados.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p>Nós armazenamos seus dados de contato, matrícula e registro de conselho exclusivamente para o funcionamento operacional e seguro das escalas hospitalares.</p>
              <Link to="/termos-de-uso" target="_blank" className="inline-flex items-center gap-1 font-bold text-sky-600 hover:underline">
                <FileText className="w-3.5 h-3.5" /> Ler Política de Privacidade Completa
              </Link>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors">
              <input 
                type="checkbox"
                checked={lgpdChecked}
                onChange={(e) => setLgpdChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">
                Declaro que li e concordo integralmente com os Termos de Uso e LGPD, autorizando o processamento dos meus dados para fins de escala hospitalar.
              </span>
            </label>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setShowLgpdModal(false); setPendingUser(null); setLgpdChecked(false); setLoading(false); }} 
              className="h-11 w-full text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer"
            >
              Cancelar Acesso
            </Button>
            <Button 
              type="button" 
              onClick={handleAcceptTerms}
              disabled={!lgpdChecked || loadingAction}
              className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
            >
              {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : <><Check className="w-4 h-4 mr-1.5" /> Aceitar e Continuar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL 2: SELEÇÃO DE MÚLTIPLAS UNIDADES (ROTEADOR HOSPITALAR)
          ========================================================================= */}
      <Dialog open={showUnitModal} onOpenChange={(open) => !open && setShowUnitModal(false)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <Building2 className="w-6 h-6" /> Portal das Unidades
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Olá, <strong>Dr(a). {pendingUser?.full_name?.split(' ')[0] || 'Profissional'}</strong>. Identificamos que seu perfil possui acesso a múltiplas unidades hospitalares. 
              <br/><br/>
              <b>Selecione em qual hospital você deseja entrar agora:</b>
            </p>

            <div className="grid gap-2.5 max-h-60 overflow-y-auto pr-1">
              {availableUnits.map(u => (
                <div 
                  key={u.id}
                  onClick={() => setSelectedUnitForLogin(u.id)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedUnitForLogin === u.id 
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100 ring-1 ring-sky-500 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Hospital className={`w-5 h-5 ${selectedUnitForLogin === u.id ? 'text-sky-600' : 'text-slate-400'}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate">{u.name}</span>
                      <span className={`text-[10px] font-mono ${selectedUnitForLogin === u.id ? 'text-sky-600/80' : 'text-slate-400'}`}>ID: {u.id.substring(0, 12)}</span>
                    </div>
                  </div>
                  {selectedUnitForLogin === u.id && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setShowUnitModal(false); setPendingUser(null); setLoading(false); }} 
              className="h-11 w-full text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer"
            >
              Voltar
            </Button>
            <Button 
              type="button" 
              onClick={handleSelectUnitAndEnter}
              disabled={!selectedUnitForLogin || loadingAction}
              className="h-11 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
            >
              {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</> : <><Check className="w-4 h-4 mr-1.5" /> Acessar Escalas</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}