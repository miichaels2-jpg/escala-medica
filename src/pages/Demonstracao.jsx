import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, Check, Copy, Loader2, Stethoscope, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { errorInPortuguese } from '@/lib/errorText';
import { BrandAppIcon, BrandWordmark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Demonstração que se monta sozinha (V0.10.8): quem quer conhecer deixa nome e e-mail e entra num
// hospital fictício já montado (setores, equipe e escala do mês). Tudo se apaga em 7 dias.
export const DEMO_LOGIN_KEY = 'sm_demo_login';

export default function Demonstracao() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim()) return setError('Informe seu nome e e-mail.');
    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('create_demo_company', { p_name: form.name.trim(), p_email: form.email.trim(), p_company: form.company.trim(), p_phone: form.phone.trim() });
      if (rpcError) throw rpcError;
      setResult(data);
    } catch (err) {
      const text = String(err?.message || '');
      setError(/Could not find the function|PGRST202/i.test(text) ? 'A demonstração ainda não está disponível. Tente de novo mais tarde.' : errorInPortuguese(text));
    } finally {
      setSaving(false);
    }
  };

  const enter = (who) => {
    const acc = result[who];
    try { window.sessionStorage.setItem(DEMO_LOGIN_KEY, JSON.stringify({ u: acc.username, p: acc.password })); } catch { /* sem armazenamento: digita na tela de entrada */ }
    navigate('/login');
  };
  const copy = (text, key) => { navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1500); }).catch(() => {}); };

  const expires = result?.expires_at ? new Date(result.expires_at).toLocaleDateString('pt-BR') : '';

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-lg bg-white/95 dark:bg-slate-900/90 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <div className="flex flex-col items-center mb-6 text-center">
          <BrandAppIcon size={56} className="mb-4 shadow-sm" />
          <h1 className="text-2xl text-slate-900 dark:text-white"><BrandWordmark /></h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium mt-2">Experimente o ScaleMedic com um hospital de demonstração, já montado.</p>
        </div>

        {!result ? (
          <form onSubmit={submit} className="space-y-4">
            <ul className="grid grid-cols-3 gap-2 text-center text-[11px] text-slate-600 dark:text-slate-300">
              <li className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2"><Stethoscope className="w-4 h-4 mx-auto mb-1 text-sky-600" />3 setores com turnos e valores</li>
              <li className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2"><Users className="w-4 h-4 mx-auto mb-1 text-sky-600" />12 profissionais fictícios</li>
              <li className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2"><CalendarCheck className="w-4 h-4 mx-auto mb-1 text-sky-600" />Escala do mês publicada</li>
            </ul>
            <div className="space-y-1.5"><Label className="text-xs">Seu nome *</Label><Input value={form.name} maxLength={80} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11" /></div>
            <div className="space-y-1.5"><Label className="text-xs">E-mail *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-11" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Hospital ou empresa</Label><Input value={form.company} maxLength={80} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Opcional" className="h-11" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telefone / WhatsApp</Label><Input value={form.phone} maxLength={30} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Opcional" className="h-11" /></div>
            </div>
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl">{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Montando o seu hospital…</> : 'Criar minha demonstração'}</Button>
            <p className="text-[11px] text-slate-500 text-center">Os dados são fictícios e tudo é apagado em 7 dias. Ao continuar, você concorda com os <Link to="/termos-de-uso" className="text-sky-600 hover:underline">Termos de Uso e LGPD</Link>.</p>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-200 text-center"><b>{result.company_name}</b> está pronto. Use até <b>{expires}</b>; depois tudo é apagado. Anote os acessos abaixo:</p>
            {[['manager', 'Coordenação', 'monta e publica a escala, vê faturamento e relatórios'], ['professional', `Plantonista (${result.professional?.name})`, 'vê a própria escala, pega vagas no Mural e pede trocas']].map(([who, title, hint]) => (
              <div key={who} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                <p className="text-[11px] text-slate-500">{hint}</p>
                <div className="flex items-center justify-between gap-2 text-sm tabular-nums">
                  <span>Usuário: <b>{result[who].username}</b> · Senha: <b>{result[who].password}</b></span>
                  <button type="button" onClick={() => copy(`Usuário: ${result[who].username}\nSenha: ${result[who].password}`, who)} className="text-sky-600 cursor-pointer" aria-label="Copiar acesso">{copied === who ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
                </div>
                <Button type="button" onClick={() => enter(who)} variant={who === 'manager' ? 'default' : 'outline'} className={`w-full h-10 rounded-xl ${who === 'manager' ? 'bg-sky-600 hover:bg-sky-500 text-white' : ''}`}>Entrar como {who === 'manager' ? 'coordenação' : 'plantonista'}</Button>
              </div>
            ))}
            <p className="text-[11px] text-slate-500 text-center">Dica: entre primeiro como coordenação, depois saia e entre como plantonista para ver os dois lados.</p>
          </div>
        )}
      </div>
      <Link to="/login" className="mt-4 text-xs text-slate-400 hover:text-slate-200">Já tenho acesso · Entrar</Link>
    </div>
  );
}
