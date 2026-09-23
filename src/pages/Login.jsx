import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Activity, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck, FileText, Check } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Estados para o Pop-up da LGPD
  const [showLgpdModal, setShowLgpdModal] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [lgpdChecked, setLgpdChecked] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(false);

  // Carrega credenciais salvas no "Lembrar-me"
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

  const proceedWithLogin = async (userRecord) => {
    window.localStorage.setItem('scale_logged_user', JSON.stringify(userRecord));
    window.localStorage.setItem('escala_medica_session', 'active');
    if (userRecord.data?.selected_unit_id) {
      window.localStorage.setItem('scale_selected_unit', userRecord.data.selected_unit_id);
    }
    try { await checkUserAuth(); } catch {}
    navigate('/');
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
    }, 8000);

    try {
      const cleanInput = loginId.trim();

      if (rememberMe) {
        window.localStorage.setItem('scale_remember_login', cleanInput);
        window.localStorage.setItem('scale_remember_pass', password);
      } else {
        window.localStorage.removeItem('scale_remember_login');
        window.localStorage.removeItem('scale_remember_pass');
      }

      // Bypass Admin Master Universal
      if ((cleanInput.toLowerCase() === 'admin' || cleanInput.toLowerCase() === 'admin@admin.com') && (password === '123456' || password === 'admin')) {
        const adminUser = {
          id: 'admin_master',
          email: 'admin@admin.com',
          full_name: 'Administrador Master',
          role: 'admin',
          data: { app_role: 'gestor', company_id: 'cmp_principal', selected_unit_id: 'unit_h1', lgpd_accepted: true }
        };
        clearTimeout(timeoutId);
        await proceedWithLogin(adminUser);
        return;
      }

      // Comunicação segura via RPC
      const { data: userRecord, error: rpcErr } = await supabase.rpc('auth_fallback_login', {
        p_login: cleanInput.toLowerCase(),
        p_password: password
      });

      clearTimeout(timeoutId);

      if (rpcErr || !userRecord) {
        throw new Error('Usuário não encontrado ou senha incorreta.');
      }

      // VERIFICAÇÃO LGPD: Se o usuário ainda não aceitou, bloqueia o acesso e mostra o Termo
      if (!userRecord.data?.lgpd_accepted) {
        setPendingUser(userRecord);
        setShowLgpdModal(true);
        setLoading(false);
        return;
      }

      // Se já aceitou, segue o fluxo normalmente
      await proceedWithLogin(userRecord);

    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!pendingUser || !lgpdChecked) return;
    setLoadingTerms(true);
    try {
      // Cria o registro legal da aceitação com data e hora exatas
      const updatedData = { 
        ...(pendingUser.data || {}), 
        lgpd_accepted: true, 
        lgpd_accepted_at: new Date().toISOString() 
      };

      // Salva a aceitação no banco de dados para proteção jurídica
      await supabase.from('users').update({ data: updatedData }).eq('id', pendingUser.id);
      
      pendingUser.data = updatedData;
      await proceedWithLogin(pendingUser);
    } catch (err) {
      setError('Erro ao registrar o aceite dos termos. Tente novamente.');
      setShowLgpdModal(false);
    } finally {
      setLoadingTerms(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 transition-colors duration-300 relative">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ScaleMedic</h1>
          <p className="text-sm text-slate-500 font-medium mt-1 text-center">Plataforma Integrada de Gestão Hospitalar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Usuário ou E-mail</Label>
            <Input 
              type="text" 
              placeholder="Ex: admin ou dr.carlos"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              disabled={loading || showLgpdModal}
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
                className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl pr-10 text-xs font-semibold"
                disabled={loading || showLgpdModal}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Lembrar-me neste dispositivo</span>
            </label>
          </div>

          <Button 
            type="submit" 
            disabled={loading || showLgpdModal} 
            className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-xl shadow-md mt-2 transition-all cursor-pointer"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Entrando...</> : 'Entrar no Sistema'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Novo na plataforma? {' '}
            <Link to="/register" className="font-bold text-sky-600 hover:text-sky-500 transition-colors">Solicite seu credenciamento</Link>
          </p>
        </div>
      </div>

      {/* RODAPÉ SIMPLES COM COPYRIGHT */}
      <div className="absolute bottom-6 text-center z-0">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          &copy; 2026 ScaleMedic. Todos os direitos reservados.
        </p>
      </div>

      {/* POP-UP DE ACEITAÇÃO LGPD (SÓ APARECE NO 1º LOGIN) */}
      <Dialog open={showLgpdModal} onOpenChange={(open) => !open && setShowLgpdModal(false)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <ShieldCheck className="w-6 h-6" /> Privacidade e LGPD
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Olá, <strong>{pendingUser?.full_name || 'Profissional'}</strong>. Como este é o seu primeiro acesso ao nosso ecossistema, precisamos que você leia e concorde com os nossos termos de tratamento de dados.
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
                Declaro que li e concordo integralmente com os Termos de Uso e Política de Privacidade (LGPD) e autorizo o processamento dos meus dados para fins de escala hospitalar.
              </span>
            </label>
          </div>

          <DialogFooter className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setShowLgpdModal(false);
                setPendingUser(null);
                setLgpdChecked(false);
              }} 
              className="h-11 w-full text-xs font-bold border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer"
            >
              Cancelar Acesso
            </Button>
            <Button 
              type="button" 
              onClick={handleAcceptTerms}
              disabled={!lgpdChecked || loadingTerms}
              className="h-11 w-full bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
            >
              {loadingTerms ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</> : <><Check className="w-4 h-4 mr-1.5" /> Aceitar e Entrar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}