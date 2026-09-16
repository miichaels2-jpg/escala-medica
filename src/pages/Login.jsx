import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!loginId || !password) {
      setError('Preencha o usuário/e-mail e a senha para continuar.');
      return;
    }

    setLoading(true);
    try {
      const rawInput = loginId.trim();
      let loggedIn = false;
      let lastErr = null;

      // Lista de formatos aceitos (nome direto ou com sufixo de e-mail da conta)
      const candidates = [rawInput];
      if (!rawInput.includes('@')) {
        candidates.push(`${rawInput.toLowerCase()}@admin.com`);
        candidates.push(`${rawInput.toLowerCase()}@hospital.com`);
        candidates.push(`${rawInput.toLowerCase()}@scalemedic.com`);
      }

      // Método oficial do SDK Base44: loginViaEmailPassword
      const authMethod = base44?.auth?.loginViaEmailPassword || base44?.auth?.signInWithPassword;

      if (!authMethod) {
        throw new Error('Módulo de autenticação da Base44 não inicializado.');
      }

      for (const emailToTry of candidates) {
        try {
          await authMethod.call(base44.auth, emailToTry, password);
          loggedIn = true;
          break;
        } catch (authErr) {
          lastErr = authErr;
        }
      }

      if (!loggedIn) {
        throw new Error(lastErr?.message || 'Credenciais inválidas. Verifique seu usuário e senha.');
      }

      // Recarrega na raiz para que o SDK inicialize com o token gravado
      window.location.href = '/';

    } catch (err) {
      setError(err.message || 'Falha ao autenticar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ScaleMedic</h1>
          <p className="text-sm text-slate-500 font-medium mt-1 text-center">Plataforma Integrada de Gestão Hospitalar</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Usuário ou E-mail</Label>
            <Input 
              type="text" 
              placeholder="Ex: admin ou seu e-mail"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="h-11 bg-slate-50 dark:bg-slate-950"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Senha</Label>
              <Link to="/forgot-password" className="text-[11px] font-bold text-sky-600 hover:underline">Esqueceu a senha?</Link>
            </div>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-50 dark:bg-slate-950 pr-10"
                disabled={loading}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white font-black text-sm rounded-xl shadow-md mt-2"
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Autenticando...</> : 'Entrar no Sistema'}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Novo na plataforma? {' '}
            <Link to="/register" className="font-bold text-sky-600 hover:underline">Solicite seu credenciamento</Link>
          </p>
        </div>
      </div>
    </div>
  );
}