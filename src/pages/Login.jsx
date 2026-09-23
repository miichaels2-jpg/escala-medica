import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!loginId || !password) {
      setError('Preencha o usuário/e-mail e a senha para continuar.');
      return;
    }

    setLoading(true);

    // Timeout de segurança para evitar que o botão trave infinitamente caso o Supabase demore
    const timeoutId = setTimeout(() => {
      setLoading(false);
      setError('A conexão com o Supabase demorou muito. Verifique suas chaves de acesso no arquivo .env.');
    }, 8000);

    try {
      const cleanInput = loginId.trim();

      // Gerencia o "Lembrar-me"
      if (rememberMe) {
        window.localStorage.setItem('scale_remember_login', cleanInput);
        window.localStorage.setItem('scale_remember_pass', password);
      } else {
        window.localStorage.removeItem('scale_remember_login');
        window.localStorage.removeItem('scale_remember_pass');
      }

      // Acesso Admin Master Universal (Bypass imediato de emergência)
      if ((cleanInput.toLowerCase() === 'admin' || cleanInput.toLowerCase() === 'admin@admin.com') && (password === '123456' || password === 'admin')) {
        const adminUser = {
          id: 'admin_master',
          email: 'admin@admin.com',
          full_name: 'Administrador Master',
          role: 'admin',
          data: { app_role: 'gestor', company_id: 'cmp_principal', selected_unit_id: 'unit_h1' }
        };
        window.localStorage.setItem('scale_logged_user', JSON.stringify(adminUser));
        window.localStorage.setItem('escala_medica_session', 'active');
        window.localStorage.setItem('scale_selected_unit', 'unit_h1');
        
        clearTimeout(timeoutId);
        try { await checkUserAuth(); } catch {}
        navigate('/');
        return;
      }

      // 🔐 COMUNICAÇÃO SEGURA: Usa a Função RPC do Supabase para validar a senha
      // Substituímos o "select('*')" inseguro por esta chamada protegida
      const { data: userRecord, error: rpcErr } = await supabase.rpc('auth_fallback_login', {
        p_login: cleanInput.toLowerCase(),
        p_password: password
      });

      clearTimeout(timeoutId);

      if (rpcErr || !userRecord) {
        throw new Error('Usuário não encontrado ou senha incorreta.');
      }

      // Grava a sessão local para sincronização instantânea
      window.localStorage.setItem('scale_logged_user', JSON.stringify(userRecord));
      window.localStorage.setItem('escala_medica_session', 'active');
      if (userRecord.data?.selected_unit_id) {
        window.localStorage.setItem('scale_selected_unit', userRecord.data.selected_unit_id);
      }

      try { await checkUserAuth(); } catch {}
      navigate('/');

    } catch (err) {
      clearTimeout(timeoutId);
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
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
              placeholder="Ex: admin ou mdevils"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"
              disabled={loading}
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
                disabled={loading}
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

          {/* CHECKBOX LEMBRAR-ME */}
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
            disabled={loading} 
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

      {/* RODAPÉ COM COPYRIGHT E LGPD */}
      <div className="absolute bottom-6 text-center z-0 flex flex-col items-center gap-2">
        <p className="text-[10px] text-slate-500 font-medium">
          Ao entrar, você concorda com nossos{' '}
          <Link to="/termos-de-uso" className="font-bold text-sky-600 hover:underline">Termos de Uso e Política de Privacidade (LGPD)</Link>.
        </p>
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          &copy; 2026 ScaleMedic. Todos os direitos reservados.
        </p>
      </div>