import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quickUsers, setQuickUsers] = useState([]);

  // Carrega os usuários cadastrados no banco para facilitar o acesso imediato
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('users').select('username, email, full_name').limit(15);
        if (data) setQuickUsers(data);
      } catch (e) {
        console.error('Erro ao buscar lista rápida de usuários:', e);
      }
    })();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!loginId) {
      setError('Digite seu usuário ou e-mail.');
      return;
    }

    setLoading(true);
    try {
      const cleanInput = loginId.trim().toLowerCase();

      // 1. Acesso Admin Master Universal
      if (cleanInput === 'admin' || cleanInput === 'admin@admin.com') {
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
        
        try { await checkUserAuth(); } catch {}
        navigate('/');
        return;
      }

      // 2. Busca o usuário diretamente na tabela pública do Supabase
      const { data: users, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .or(`email.ilike.%${cleanInput}%,username.ilike.%${cleanInput}%`);

      if (dbErr || !users || users.length === 0) {
        throw new Error('Usuário não encontrado no sistema. Verifique o nome digitado.');
      }

      const targetUser = users[0];

      // Injeta a sessão localmente para que o useAppData e o AuthContext reconheçam o usuário instantaneamente
      window.localStorage.setItem('scale_logged_user', JSON.stringify(targetUser));
      window.localStorage.setItem('escala_medica_session', 'active');
      if (targetUser.data?.selected_unit_id) {
        window.localStorage.setItem('scale_selected_unit', targetUser.data.selected_unit_id);
      }

      try { await checkUserAuth(); } catch {}
      navigate('/');

    } catch (err) {
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (usernameOrEmail) => {
    setLoginId(usernameOrEmail);
    setPassword('123456');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ScaleMedic</h1>
          <p className="text-sm text-slate-500 font-medium mt-1 text-center">Plataforma Integrada de Gestão Hospitalar</p>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Usuário ou E-mail</Label>
            <Input 
              type="text" 
              placeholder="Ex: admin ou mdevils"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Senha</Label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl pr-10"
                disabled={loading}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-xl shadow-md mt-2 cursor-pointer"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Entrando...</> : 'Entrar no Sistema'}
          </Button>
        </form>

        {quickUsers.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Acesso Rápido (Clique para preencher):
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 cursor-pointer"
              >
                👑 admin
              </button>
              {quickUsers.map((u, idx) => (
                u.username && u.username !== 'admin' && (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickLogin(u.username || u.email)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer truncate max-w-[140px]"
                    title={u.full_name || u.username}
                  >
                    👤 {u.username}
                  </button>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}