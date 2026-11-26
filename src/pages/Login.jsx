import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { InstallAppDialog } from '@/components/InstallAppGuide';
import { usePwaInstall } from '@/lib/pwa';
import { APP_VERSION } from '@/lib/version';
import { formatLockWait, passwordProblem } from '@/lib/passwordPolicy';
import { openOfficialSession } from '@/lib/authSession';
import { isRealEmail, recoveryRequestError } from '@/lib/passwordRecovery';
import { listMyCompanies, switchCompany } from '@/lib/companyAccess';
import { TERMS_VERSION, needsTermsAcceptance } from '@/lib/terms';
import { isManagerUser } from '@/lib/accessControl';
import { BrandAppIcon, BrandWordmark } from '@/components/BrandMark';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, 
  FileText, Check, Building2, Hospital, CheckCircle2, KeyRound, Smartphone, Mail 
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

  // Estados dos Modais em Cascata de Segurança
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  
  const [pendingUser, setPendingUser] = useState(null);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [selectedUnitForLogin, setSelectedUnitForLogin] = useState('');
  // Um login para vários estabelecimentos: escolhe em qual entrar (V0.8.1).
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedCompanyForLogin, setSelectedCompanyForLogin] = useState('');
  const companyChosenRef = useRef(false);
  
  // Controle de formulários internos
  const [lgpdChecked, setLgpdChecked] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  // Esqueceu a senha: link por e-mail (V0.8.6).
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotSending, setForgotSending] = useState(false);
  const { isInstalled } = usePwaInstall();

  useEffect(() => {
    try {
      // "Lembrar-me" guarda só o usuário. Senhas gravadas por versões antigas são apagadas.
      window.localStorage.removeItem('scale_remember_pass');
      const savedLogin = window.localStorage.getItem('scale_remember_login');
      if (savedLogin) {
        setLoginId(savedLogin);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const proceedWithLogin = async (rawUserRecord, unitIdToSave) => {
    // Nunca guarda senha ou hash no navegador.
    const { password: _password, password_hash: _passwordHash, ...userRecord } = rawUserRecord || {};
    window.localStorage.setItem('scale_logged_user', JSON.stringify(userRecord));
    window.localStorage.setItem('escala_medica_session', 'active');
    
    if (unitIdToSave) {
      window.localStorage.setItem('scale_selected_unit', unitIdToSave);
      try {
        await supabase.from('users').update({ 
          data: { ...(userRecord.data || {}), selected_unit_id: unitIdToSave } 
        }).eq('id', userRecord.id);
      } catch {}
    } else if (userRecord.data?.selected_unit_id) {
      window.localStorage.setItem('scale_selected_unit', userRecord.data.selected_unit_id);
    }
    
    try { await checkUserAuth(); } catch {}
    navigate('/');
  };

  // 🚀 O MOTOR DE ROTEAMENTO (Ele avalia os 3 escudos de segurança em ordem)
  const continueLoginFlow = (uRec, uList) => continueLoginFlowWith(uRec, uList, availableCompanies);

  // A lista de estabelecimentos vem por parâmetro: logo após o login o estado ainda não atualizou.
  const continueLoginFlowWith = (uRec, uList, companies) => {
    if (uRec.data?.must_change_password) {
      setPendingUser(uRec);
      setAvailableUnits(uList);
      setShowPasswordChangeModal(true);
      return;
    }
    if (needsTermsAcceptance(uRec.data)) {
      setPendingUser(uRec);
      setAvailableUnits(uList);
      setShowLgpdModal(true);
      return;
    }
    if (companies.length > 1 && !companyChosenRef.current) {
      setPendingUser(uRec);
      setAvailableUnits(uList);
      setSelectedCompanyForLogin(String(companies.find(c => c.current)?.id || companies[0].id));
      setShowCompanyModal(true);
      return;
    }
    if (uList.length > 1 && isManagerUser(uRec)) {
      setPendingUser(uRec);
      setAvailableUnits(uList);
      setSelectedUnitForLogin(uList[0].id);
      setShowUnitModal(true);
      return;
    }
    const lastUnit = uList.find(u => String(u.id) === String(uRec.data?.selected_unit_id));
    proceedWithLogin(uRec, lastUnit?.id || uList[0]?.id || uRec.data?.selected_unit_id);
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
      } else {
        window.localStorage.removeItem('scale_remember_login');
      }

      // O login de emergência embutido no app foi removido (V0.2.9): a conta "admin" é um
      // usuário real do banco, com senha própria guardada só como hash.

      const { data: userRecord, error: rpcErr } = await supabase.rpc('auth_fallback_login', {
        p_login: cleanInput.toLowerCase(),
        p_password: password
      });

      if (rpcErr || !userRecord) {
        // Após 5 senhas erradas seguidas o login fica bloqueado por 15 minutos (regra no banco).
        const { data: lockSeconds } = await supabase.rpc('login_lock_status', { p_login: cleanInput.toLowerCase() });
        if (Number(lockSeconds) > 0) {
          throw new Error(`Muitas tentativas com senha errada. Por segurança, o acesso foi bloqueado por ${formatLockWait(lockSeconds)}.`);
        }
        throw new Error('Usuário não encontrado ou senha incorreta.');
      }

      // Sessão oficial do Supabase: desde a V0.3.1 o banco só responde com ela.
      if (!(await openOfficialSession(userRecord.email, password))) {
        throw new Error('Não foi possível abrir sua sessão segura. Tente de novo; se continuar, procure a coordenação.');
      }

      clearTimeout(timeoutId);
      companyChosenRef.current = false;
      const companies = await listMyCompanies();
      setAvailableCompanies(companies);
      if (companies.length > 1) {
        // A escolha do estabelecimento vem depois de senha e termos; as unidades carregam depois dela.
        continueLoginFlowWith(userRecord, [], companies);
        return;
      }

      // Inicia a verificação dos Escudos (Senha -> LGPD -> Múltiplas Unidades)
      continueLoginFlowWith(userRecord, await loadUnitsFor(userRecord), companies);

    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  // Hospitais do estabelecimento do cadastro que o usuário pode abrir.
  const loadUnitsFor = async (userRecord) => {
      const compId = userRecord.data?.company_id || userRecord.company_id || 'cmp_principal';
      const { data: compData, error: companyError } = await supabase
        .from('companies')
        .select('units,data')
        .eq('id', compId)
        .maybeSingle();
      if (companyError) throw companyError;

      const { data: unitRows, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .eq('company_id', compId)
        .order('name');
      if (unitsError && unitsError.code !== 'PGRST205') throw unitsError;

      const embeddedUnits = Array.isArray(compData?.units) && compData.units.length > 0
        ? compData.units
        : compData?.data?.units || [];
      const allUnits = unitRows?.length ? unitRows : embeddedUnits;
      const allowedIds = Array.isArray(userRecord.data?.allowed_unit_ids)
        ? userRecord.data.allowed_unit_ids.map(String)
        : [];
      
      let myUnits = allUnits;
      if (userRecord.role !== 'admin') {
        myUnits = allUnits.filter(u => allowedIds.includes(String(u.id)));
      }
      return myUnits;
  };

  const handleSelectCompanyAndEnter = async () => {
    if (!selectedCompanyForLogin || !pendingUser) return;
    setLoadingAction(true);
    try {
      const current = availableCompanies.find(c => c.current);
      const nextUser = String(current?.id) === String(selectedCompanyForLogin)
        ? pendingUser
        : await switchCompany(pendingUser, selectedCompanyForLogin);
      const units = await loadUnitsFor(nextUser);
      companyChosenRef.current = true;
      setShowCompanyModal(false);
      // O estabelecimento abre com todos os hospitais dele; a unidade troca no topo da tela.
      const lastUnit = units.find(u => String(u.id) === String(nextUser.data?.selected_unit_id));
      await proceedWithLogin(nextUser, lastUnit?.id || units[0]?.id || nextUser.data?.selected_unit_id);
    } catch (err) {
      setShowCompanyModal(false);
      setPendingUser(null);
      setError(err.message || 'Não foi possível abrir o estabelecimento.');
      setLoading(false);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    const problem = passwordProblem(newPassword, { username: pendingUser?.username, email: pendingUser?.email });
    if (problem) return setPasswordError(problem);
    if (newPassword !== confirmNewPassword) return setPasswordError('As senhas não coincidem. Tente novamente.');

    setLoadingAction(true);
    try {
      const updatedData = { ...pendingUser.data };
      delete updatedData.must_change_password;

      const { error: passwordUpdateError } = await supabase.from('users').update({ 
        password: newPassword,
        data: updatedData 
      }).eq('id', pendingUser.id);
      if (passwordUpdateError) throw passwordUpdateError;

      pendingUser.data = updatedData;

      setShowPasswordChangeModal(false);
      continueLoginFlow(pendingUser, availableUnits);
    } catch {
      setPasswordError('Erro de sistema ao salvar a nova senha.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!pendingUser || !lgpdChecked) return;
    setLoadingAction(true);
    try {
      // O banco grava a data (do servidor) e a versão dos termos; sem esse registro, não entra.
      const { data: savedData, error: acceptError } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION });
      if (acceptError) throw acceptError;

      pendingUser.data = savedData || { ...(pendingUser.data || {}), lgpd_accepted: true, lgpd_terms_version: TERMS_VERSION };
      setShowLgpdModal(false);
      continueLoginFlow(pendingUser, availableUnits);
    } catch {
      // sem o aceite registrado, a sessão aberta no login é encerrada
      try { await supabase.auth.signOut(); } catch { /* segue */ }
      setError('Não foi possível registrar o aceite dos termos. Tente de novo.');
      setShowLgpdModal(false);
      setLoading(false);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSelectUnitAndEnter = () => {
    if (!selectedUnitForLogin) return;
    setLoadingAction(true);
    proceedWithLogin(pendingUser, selectedUnitForLogin);
  };

  const openForgot = () => {
    setForgotEmail(loginId.includes('@') ? loginId.trim() : '');
    setForgotError('');
    setForgotSent(false);
    setForgotOpen(true);
  };

  const handleSendRecovery = async (e) => {
    e.preventDefault();
    setForgotError('');
    const email = forgotEmail.trim().toLowerCase();
    if (!isRealEmail(email)) return setForgotError('Digite o e-mail do seu cadastro. Se você não tem e-mail cadastrado, procure a coordenação ou o RH da sua unidade.');
    setForgotSending(true);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` });
      if (sendError) throw sendError;
      setForgotSent(true);
    } catch (err) {
      setForgotError(recoveryRequestError(err));
    } finally {
      setForgotSending(false);
    }
  };

  const resetModals = () => {
    setShowPasswordChangeModal(false);
    setShowLgpdModal(false);
    setShowUnitModal(false);
    setShowCompanyModal(false);
    setPendingUser(null);
    setLoading(false);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex flex-col justify-center items-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] relative overflow-hidden transition-colors duration-500 font-sans">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M28 20h4v8h8v4h-8v-8h-4v-8h-8v-4h8v-8z\' fill=\'%230ea5e9\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] bg-sky-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 relative">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <BrandAppIcon size={56} className="mb-4 shadow-sm" />
          <h1 className="text-2xl text-slate-900 dark:text-white"><BrandWordmark /></h1>
          <p className="text-xs text-slate-500 font-medium mt-1 text-center">Gestão Hospitalar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Usuário ou E-mail</Label>
            <Input 
              type="text" 
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors"
              disabled={loading || showLgpdModal || showUnitModal || showCompanyModal || showPasswordChangeModal}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Senha</Label>
              <Button type="button" variant="link" className="h-auto p-0 text-[11px] font-semibold text-sky-600 hover:text-sky-500 transition-colors cursor-pointer" onClick={openForgot}>
                Esqueceu a senha?
              </Button>
            </div>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl pr-10 text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors"
                disabled={loading || showLgpdModal || showUnitModal || showCompanyModal || showPasswordChangeModal}
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
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Lembrar-me neste dispositivo</span>
            </label>
            <span className="text-[11px] tabular-nums font-medium text-slate-400 dark:text-slate-500" title="Versão do aplicativo">{APP_VERSION}</span>
          </div>

          <Button 
            type="submit" 
            disabled={loading || showLgpdModal || showUnitModal || showCompanyModal || showPasswordChangeModal} 
            className="w-full h-12 sm:h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-xl shadow-sm mt-2 transition-all cursor-pointer hover:scale-[1.02]"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Conectando...</> : 'Entrar no Sistema'}
          </Button>
        </form>

        {/* ========================================================= */}
        {/* BLOCO DE CADASTRO RESTAURADO ============================ */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Novo na plataforma? {' '}
            <Link to="/register" className="font-semibold text-sky-600 hover:text-sky-500 transition-colors">Solicite seu credenciamento</Link>
          </p>
        </div>
        {/* ========================================================= */}
        
      </div>

      {!isInstalled && (
        <button
          type="button"
          onClick={() => setInstallGuideOpen(true)}
          className="mt-4 z-10 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-sky-100 transition-colors cursor-pointer"
        >
          <img src="/icons/icon-192.png" alt="" className="w-6 h-6 rounded-lg" />
          <Smartphone className="w-4 h-4" /> Instalar o app no celular
        </button>
      )}

      <InstallAppDialog open={installGuideOpen} onOpenChange={setInstallGuideOpen} />

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-2">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <Mail className="w-6 h-6 text-sky-600 dark:text-sky-400" /> Recuperar a senha
            </DialogTitle>
          </DialogHeader>
          {forgotSent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 leading-relaxed">
                  Se <strong>{forgotEmail.trim().toLowerCase()}</strong> estiver cadastrado, você vai receber em alguns minutos um e-mail do ScaleMedic com o link para criar uma senha nova. O link vale por 1 hora. Confira também a caixa de spam.
                </p>
              </div>
              <Button type="button" onClick={() => setForgotOpen(false)} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer">Entendi</Button>
            </div>
          ) : (
            <form onSubmit={handleSendRecovery} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                Digite o e-mail do seu cadastro. Vamos mandar um link para você criar uma senha nova.
              </p>
              {forgotError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {forgotError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">E-mail</Label>
                <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} autoComplete="email" required
                  placeholder="seu@email.com" className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">Sem e-mail no cadastro? Procure a coordenação ou o RH da sua unidade para trocar a senha.</p>
              <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)} className="h-11 w-full text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">Voltar</Button>
                <Button type="submit" disabled={forgotSending} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs cursor-pointer">
                  {forgotSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative mt-6 sm:mt-0 sm:absolute sm:bottom-6 text-center z-0 flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-[10px] text-slate-400 font-medium">
          Ao entrar, você concorda com nossos <Link to="/termos-de-uso" className="font-semibold text-sky-400 hover:underline">Termos de Uso e LGPD</Link>.
        </p>
        <p className="text-xs font-medium text-slate-500">
          &copy; 2026 ScaleMedic Enterprise. Todos os direitos reservados.
        </p>
      </div>

      {/* =========================================================================
          ESCUDO 1: TROCA DE SENHA OBRIGATÓRIA NO 1º ACESSO
          ========================================================================= */}
      <Dialog open={showPasswordChangeModal} onOpenChange={(open) => !open && resetModals()}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
              <KeyRound className="w-6 h-6 text-sky-600 dark:text-sky-400" /> Crie sua senha
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Olá, <strong>{pendingUser?.full_name?.split(' ')[0]}</strong>. Você entrou com a senha provisória. Crie agora a sua senha pessoal; ela vale a partir do próximo acesso.
            </p>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {passwordError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nova Senha</Label>
                <Input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="8+ caracteres, com letras e números" 
                  className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl tabular-nums" 
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confirme a Nova Senha</Label>
                <Input 
                  type="password" 
                  value={confirmNewPassword} 
                  onChange={e => setConfirmNewPassword(e.target.value)} 
                  placeholder="Digite novamente" 
                  className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl tabular-nums" 
                  required 
                />
              </div>
            </div>

            <DialogFooter className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={resetModals} className="h-11 w-full text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">
                Sair
              </Button>
              <Button type="submit" disabled={loadingAction} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all">
                {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4 mr-1.5" /> Salvar e Continuar</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          ESCUDO 2: ACEITE DA LGPD (PRIMEIRO ACESSO)
          ========================================================================= */}
      <Dialog open={showLgpdModal} onOpenChange={(open) => !open && resetModals()}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-6 h-6" /> Privacidade e LGPD
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Olá, <strong>{pendingUser?.full_name?.split(' ')[0] || 'Profissional'}</strong>. Como este é o seu primeiro acesso ao nosso ecossistema, precisamos que você leia e concorde com os nossos termos de tratamento de dados.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p>Nós armazenamos seus dados de contato, matrícula e registro de conselho exclusivamente para o funcionamento operacional e seguro das escalas hospitalares.</p>
              <Link to="/termos-de-uso" target="_blank" className="inline-flex items-center gap-1 font-semibold text-sky-600 hover:underline">
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
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                Declaro que li e concordo integralmente com os Termos de Uso e LGPD, autorizando o processamento dos meus dados para fins de escala hospitalar.
              </span>
            </label>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button type="button" variant="outline" onClick={resetModals} className="h-11 w-full text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">
              Cancelar Acesso
            </Button>
            <Button type="button" onClick={handleAcceptTerms} disabled={!lgpdChecked || loadingAction} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all">
              {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : <><Check className="w-4 h-4 mr-1.5" /> Aceitar e Continuar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          ESCUDO 3A: ESTABELECIMENTO (UM LOGIN PARA VÁRIAS EMPRESAS)
          ========================================================================= */}
      <Dialog open={showCompanyModal} onOpenChange={(open) => !open && resetModals()}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <Building2 className="w-6 h-6" /> Escolha o estabelecimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Olá, <strong>{pendingUser?.full_name?.split(' ')[0] || 'Gestor'}</strong>. Seu login abre mais de um estabelecimento. Em qual quer entrar agora? Dá para trocar depois no topo da tela, sem sair.
            </p>

            <div className="grid gap-2.5 max-h-60 overflow-y-auto pr-1">
              {availableCompanies.map(c => {
                const chosen = String(selectedCompanyForLogin) === String(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setSelectedCompanyForLogin(String(c.id))}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between text-left cursor-pointer transition-all ${
                      chosen
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100 ring-1 ring-sky-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-300 dark:hover:border-sky-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Building2 className={`w-5 h-5 shrink-0 ${chosen ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span className="min-w-0">
                        <span className="text-sm font-semibold truncate block">{c.name}</span>
                        {c.current && <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Último acessado</span>}
                      </span>
                    </span>
                    {chosen && <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button type="button" variant="outline" onClick={resetModals} className="h-11 w-full text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">
              Voltar
            </Button>
            <Button type="button" onClick={handleSelectCompanyAndEnter} disabled={!selectedCompanyForLogin || loadingAction} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all">
              {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Abrindo...</> : <><Check className="w-4 h-4 mr-1.5" /> Entrar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          ESCUDO 3: SELEÇÃO DE MÚLTIPLAS UNIDADES (ROTEADOR HOSPITALAR)
          ========================================================================= */}
      <Dialog open={showUnitModal} onOpenChange={(open) => !open && resetModals()}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <Building2 className="w-6 h-6" /> Escolha o hospital
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Olá, <strong>{pendingUser?.full_name?.split(' ')[0] || 'Gestor'}</strong>. Você administra mais de um hospital. Em qual quer entrar agora? Dá para trocar depois no topo da tela.
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
                    <span className="text-sm font-semibold truncate">{u.name}</span>
                  </div>
                  {selectedUnitForLogin === u.id && <CheckCircle2 className="w-5 h-5 text-sky-600" />}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button type="button" variant="outline" onClick={resetModals} className="h-11 w-full text-xs font-medium border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">
              Voltar
            </Button>
            <Button type="button" onClick={handleSelectUnitAndEnter} disabled={!selectedUnitForLogin || loadingAction} className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm cursor-pointer transition-all">
              {loadingAction ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</> : <><Check className="w-4 h-4 mr-1.5" /> Entrar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}