import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { appUserIdFromSession, clearStoredSession } from '@/lib/authSession';
import { passwordProblem } from '@/lib/passwordPolicy';
import { recoveryLinkError } from '@/lib/passwordRecovery';
import { BrandAppIcon, BrandWordmark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, KeyRound, CheckCircle2, Check } from 'lucide-react';

// Tela aberta pelo link do e-mail "Redefinir senha" (V0.8.6). O link abre uma sessão de
// recuperação; a senha nova vai para o cadastro do ScaleMedic, que atualiza a conta oficial.
export default function RedefinirSenha() {
  const [status, setStatus] = useState('loading'); // loading | ready | invalid | done
  const [linkError, setLinkError] = useState('');
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hashError = recoveryLinkError(window.location.hash);
    if (hashError) {
      setLinkError(hashError);
      setStatus('invalid');
      return;
    }
    let cancelled = false;
    (async () => {
      // getSession espera o Supabase ler o token do link.
      const { data: { session } } = await supabase.auth.getSession();
      const appUserId = appUserIdFromSession(session);
      if (!appUserId) {
        if (!cancelled) {
          setLinkError('Este link não é válido ou já foi usado. Peça um novo na tela de entrada, em "Esqueceu a senha?".');
          setStatus('invalid');
        }
        return;
      }
      const { data } = await supabase.from('users').select('id, full_name, username, email, data').eq('id', appUserId).maybeSingle();
      if (cancelled) return;
      setAccount(data || { id: appUserId });
      setStatus('ready');
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(password, { username: account?.username, email: account?.email });
    if (problem) return setError(problem);
    if (password !== confirm) return setError('As senhas não coincidem. Tente novamente.');

    setSaving(true);
    try {
      const update = { password };
      if (account?.data?.must_change_password) {
        const data = { ...account.data };
        delete data.must_change_password;
        update.data = data;
      }
      const { error: saveError } = await supabase.from('users').update(update).eq('id', account.id);
      if (saveError) throw saveError;
      // Encerra a sessão do link: a pessoa entra de novo com a senha nova.
      clearStoredSession();
      await supabase.auth.signOut().catch(() => {});
      setStatus('done');
    } catch {
      setError('Não foi possível salvar a nova senha. Tente de novo; se continuar, procure a coordenação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex flex-col items-center mb-6">
          <BrandAppIcon size={56} className="mb-4 shadow-sm" />
          <h1 className="text-2xl text-slate-900 dark:text-white"><BrandWordmark /></h1>
          <p className="text-xs text-slate-500 font-medium mt-1 text-center">Redefinir senha</p>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-sky-600" /></div>
        )}

        {status === 'invalid' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 leading-relaxed">{linkError}</p>
            </div>
            <Button asChild className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl">
              <Link to="/login">Ir para a tela de entrada</Link>
            </Button>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed flex items-start gap-2">
              <KeyRound className="w-5 h-5 text-sky-600 shrink-0" />
              <span>{account?.full_name ? <>Olá, <strong>{account.full_name.split(' ')[0]}</strong>. </> : null}Crie a sua nova senha. Ela passa a valer na hora.</span>
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nova senha</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"
                placeholder="8+ caracteres, com letras e números" required
                className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confirme a nova senha</Label>
              <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"
                placeholder="Digite novamente" required
                className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            <Button type="submit" disabled={saving} className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Check className="w-4 h-4 mr-1.5" /> Salvar nova senha</>}
            </Button>
          </form>
        )}

        {status === 'done' && (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
              Senha alterada. Entre com o seu usuário e a senha nova.
            </p>
            <Button asChild className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-xl">
              <a href="/login">Entrar</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
