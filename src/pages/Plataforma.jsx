import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Hospital, KeyRound, Loader2, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { birthDatePassword, generateProvisionalPassword } from '@/lib/passwordPolicy';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PLANS = [
  { id: 'trial', label: 'Teste' },
  { id: 'ativo', label: 'Contrato ativo' },
  { id: 'demo', label: 'Demonstração' }
];
const planLabel = id => PLANS.find(p => p.id === id)?.label || id || 'Teste';

const EMPTY_MANAGER = { full_name: '', username: '', email: '', birth_date: '' };
const EMPTY_COMPANY = { name: '', unit_name: '', plan: 'trial', ...EMPTY_MANAGER };

export function registrationLink(code) {
  return `${window.location.origin}/register?empresa=${code}`;
}

function suggestUsername(name) {
  const parts = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
}

function firstAccessPassword(manager) {
  return birthDatePassword(manager.full_name, manager.birth_date) || generateProvisionalPassword();
}

function CopyButton({ text, label = 'Copiar' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('Copie o texto:', text);
    }
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="h-8 gap-1.5 shrink-0">
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? 'Copiado' : label}
    </Button>
  );
}

function ManagerFields({ value, onChange }) {
  const set = (key, v) => {
    const next = { ...value, [key]: v };
    if (key === 'full_name' && (!value.username || value.username === suggestUsername(value.full_name))) next.username = suggestUsername(v);
    onChange(next);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Nome do gestor *</Label>
        <Input value={value.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Ex.: Maria Souza" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Usuário de login *</Label>
        <Input value={value.username} onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))} placeholder="maria.souza" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">E-mail (opcional)</Label>
        <Input type="email" value={value.email} onChange={e => set('email', e.target.value)} placeholder="maria@hospital.com.br" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Data de nascimento (para a senha padrão)</Label>
        <Input type="date" value={value.birth_date} onChange={e => set('birth_date', e.target.value)} className="sm:w-56" />
        <p className="text-[11px] text-slate-500">Senha do 1º acesso: data de nascimento + inicial do nome. Sem a data, o sistema gera uma aleatória. A troca é obrigatória no primeiro login.</p>
      </div>
    </div>
  );
}

// Painel do dono da plataforma: empresas clientes, seus gestores e links de credenciamento.
export default function Plataforma() {
  const [isOwner, setIsOwner] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'company' } | { type: 'manager' | 'unit', company }
  const [form, setForm] = useState(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null); // credenciais para entregar ao cliente
  const [appErrors, setAppErrors] = useState([]); // erros que os usuários viram (report_app_error)
  const [openErrorId, setOpenErrorId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: owner } = await supabase.rpc('sm_auth_is_platform_owner');
    setIsOwner(Boolean(owner));
    if (!owner) { setLoading(false); return; }
    const { data, error: loadError } = await supabase.rpc('platform_companies');
    if (loadError) setError(`Não foi possível carregar as empresas: ${loadError.message}`);
    setCompanies(Array.isArray(data) ? data : []);
    const { data: errs } = await supabase.rpc('platform_app_errors', { p_limit: 50 });
    setAppErrors(Array.isArray(errs) ? errs : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCompany = () => { setForm(EMPTY_COMPANY); setFormError(''); setDialog({ type: 'company' }); };
  const openManager = company => { setForm({ ...EMPTY_MANAGER }); setFormError(''); setDialog({ type: 'manager', company }); };
  const openUnit = company => { setForm({ ...EMPTY_COMPANY, unit_name: '' }); setFormError(''); setDialog({ type: 'unit', company }); };

  const createManager = async (companyId, manager) => {
    const password = firstAccessPassword(manager);
    const { data, error: rpcError } = await supabase.rpc('platform_create_manager', {
      p_company_id: companyId, p_full_name: manager.full_name.trim(), p_username: manager.username.trim(),
      p_email: manager.email.trim(), p_password: password
    });
    if (rpcError) throw rpcError;
    return { ...data, password, isBirthDefault: password === birthDatePassword(manager.full_name, manager.birth_date) };
  };

  const submit = async e => {
    e.preventDefault();
    setFormError('');
    if (dialog.type !== 'unit' && (!form.full_name.trim() || !form.username.trim())) return setFormError('Informe o nome e o usuário do gestor.');
    setSaving(true);
    try {
      if (dialog.type === 'unit') {
        // Hospital a mais na empresa: já fica liberado para os gestores gerais dela.
        if (!form.unit_name.trim()) throw new Error('Informe o nome do hospital.');
        const { error: rpcError } = await supabase.rpc('platform_add_unit', { p_company_id: dialog.company.id, p_name: form.unit_name.trim() });
        if (rpcError) throw rpcError;
        setDialog(null);
        load();
        return;
      }
      if (dialog.type === 'company') {
        if (!form.name.trim() || !form.unit_name.trim()) throw new Error('Informe o nome da empresa e da primeira unidade.');
        const { data: company, error: rpcError } = await supabase.rpc('platform_create_company', {
          p_name: form.name.trim(), p_unit_name: form.unit_name.trim(), p_plan: form.plan
        });
        if (rpcError) throw rpcError;
        try {
          const manager = await createManager(company.id, form);
          setResult({ companyName: company.name, manager, code: company.registration_code });
        } catch (managerError) {
          // A empresa já existe: o gestor pode ser criado depois pelo botão "Adicionar gestor".
          setResult({ companyName: company.name, code: company.registration_code, managerError: managerError.message });
        }
      } else {
        const manager = await createManager(dialog.company.id, form);
        setResult({ companyName: dialog.company.name, manager, code: dialog.company.registration_code });
      }
      setDialog(null);
      load();
    } catch (err) {
      setFormError(err.message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (company, manager) => {
    const password = generateProvisionalPassword();
    if (!window.confirm(`Redefinir a senha de ${manager.full_name}?\n\nA nova senha provisória será mostrada a seguir e a troca é obrigatória no próximo login.`)) return;
    const { error: rpcError } = await supabase.rpc('platform_reset_password', { p_user_id: manager.id, p_password: password });
    if (rpcError) return window.alert(`Não foi possível redefinir: ${rpcError.message}`);
    setResult({ companyName: company.name, manager: { ...manager, password, isBirthDefault: false }, code: company.registration_code, isReset: true });
    load();
  };

  const credentialsText = r => [
    `ScaleMedic — ${r.companyName}`,
    `Endereço: ${window.location.origin}`,
    r.manager && `Usuário: ${r.manager.username}`,
    r.manager && `Senha do primeiro acesso: ${r.manager.password} (o sistema pede para trocar ao entrar)`,
    `Link de credenciamento dos profissionais: ${registrationLink(r.code)}`,
    `Código do hospital (para quem abrir o formulário pela tela de entrada): ${r.code}`
  ].filter(Boolean).join('\n');

  if (isOwner === false) {
    return (
      <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100">
        <p className="text-sm text-slate-500">Esta área é restrita ao dono da plataforma.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 space-y-5 text-slate-900 dark:text-slate-100">
      <PageHero
        title="Plataforma"
        subtitle="Empresas clientes, seus gestores e os links de credenciamento. Cada empresa só enxerga os próprios dados."
        actions={t => (
          <div className="flex gap-2">
            <Button type="button" onClick={load} disabled={loading} className={`font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none ${t.outline}`}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            <Button type="button" onClick={openCompany} className={`font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none font-semibold ${t.primary}`}><Plus className="w-4 h-4" /> Nova empresa</Button>
          </div>
        )}
      />

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

      {loading && companies.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando empresas...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {companies.map(company => (
            <section key={company.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold truncate">{company.name}</h2>
                  <p className="text-xs text-slate-500">
                    {planLabel(company.plan)} · desde {new Date(company.created_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-4 gap-2 text-center">
                {[['Unidades', company.units.length], ['Usuários', company.users_count], ['Profissionais', company.professionals_count], ['Plantões', company.shifts_count]].map(([label, n]) => (
                  <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 py-2">
                    <dt className="text-[11px] text-slate-500">{label}</dt>
                    <dd className="text-base font-bold tabular-nums">{n}</dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500">Hospitais</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openUnit(company)} className="h-8 gap-1.5"><Plus className="w-3.5 h-3.5" /> Adicionar hospital</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {company.units.length === 0 && <p className="text-sm text-slate-500">Nenhum hospital ainda.</p>}
                  {company.units.map(u => (
                    <span key={u.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium">
                      <Hospital className="w-3.5 h-3.5 text-slate-400" /> {u.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-500">Gestores</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openManager(company)} className="h-8 gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Adicionar gestor</Button>
                </div>
                {company.managers.length === 0 && <p className="text-sm text-slate-500">Nenhum gestor ainda.</p>}
                {company.managers.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{m.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{m.username}{m.must_change_password ? ' · ainda não trocou a senha' : ''}{m.is_active ? '' : ' · inativo'}</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => resetPassword(company, m)} className="h-8 gap-1.5 shrink-0"><KeyRound className="w-3.5 h-3.5" /> Redefinir senha</Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-500">Credenciamento de profissionais</h3>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-slate-500">Código</span>
                  <code className="flex-1 min-w-0 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm font-bold">{company.registration_code}</code>
                  <CopyButton text={company.registration_code} label="Copiar código" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-xs text-slate-500">Link</span>
                  <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs">{registrationLink(company.registration_code)}</code>
                  <CopyButton text={registrationLink(company.registration_code)} label="Copiar link" />
                </div>
                <p className="text-[11px] text-slate-500">O link já abre o formulário com o hospital preenchido. O código serve para quem abrir o formulário pela tela de entrada.</p>
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Erros recentes</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">O que apareceu como erro para os usuários, de todas as empresas. Clique para ver os detalhes técnicos.</p>
          </div>
          <AlertTriangle className={`w-5 h-5 shrink-0 ${appErrors.length ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'}`} />
        </div>
        {appErrors.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nenhum erro registrado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {appErrors.map(err => (
              <li key={err.id} className="py-2.5">
                <button type="button" onClick={() => setOpenErrorId(openErrorId === err.id ? null : err.id)} className="w-full text-left cursor-pointer">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">{new Date(err.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{err.message}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {[err.company_name || 'Sem login', err.user_name, err.path, err.app_version].filter(Boolean).join(' · ')}
                  </div>
                </button>
                {openErrorId === err.id && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-[11px] leading-snug text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{[err.kind, err.user_agent, err.stack].filter(Boolean).join('\n\n')}</pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={Boolean(dialog)} onOpenChange={open => { if (!open && !saving) setDialog(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.type === 'company' ? 'Nova empresa' : dialog?.type === 'unit' ? `Novo hospital · ${dialog?.company?.name || ''}` : `Novo gestor · ${dialog?.company?.name || ''}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            {dialog?.type === 'company' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Nome da empresa *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Grupo Hospitalar Bom Jesus" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Primeira unidade (hospital) *</Label>
                  <Input value={form.unit_name} onChange={e => setForm({ ...form, unit_name: e.target.value })} placeholder="Ex.: Hospital Bom Jesus Centro" />
                  <p className="text-[11px] text-slate-500">Outras unidades o gestor cadastra depois em Configurações.</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Situação</Label>
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    {PLANS.map(p => (
                      <button key={p.id} type="button" onClick={() => setForm({ ...form, plan: p.id })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${form.plan === p.id ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'}`}>{p.label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {dialog?.type === 'unit' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do hospital *</Label>
                <Input value={form.unit_name} onChange={e => setForm({ ...form, unit_name: e.target.value })} placeholder="Ex.: Hospital Bom Jesus Zona Sul" autoFocus />
                <p className="text-[11px] text-slate-500">Os gestores gerais da empresa passam a ver este hospital no mesmo login. CNPJ, endereço e logo o gestor completa em Configurações.</p>
              </div>
            )}
            {dialog?.type === 'company' && <h3 className="text-xs font-semibold text-slate-500">Primeiro gestor</h3>}
            {dialog?.type !== 'unit' && <ManagerFields value={form} onChange={next => setForm({ ...form, ...next })} />}
            {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-4 h-4 animate-spin" />} {dialog?.type === 'company' ? 'Criar empresa' : dialog?.type === 'unit' ? 'Adicionar hospital' : 'Criar gestor'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(result)} onOpenChange={open => { if (!open) setResult(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{result?.isReset ? 'Senha redefinida' : result?.manager ? 'Acesso criado' : 'Empresa criada'}</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3 text-sm">
              {result.managerError && <p className="text-rose-600">A empresa foi criada, mas o gestor não: {result.managerError} Use “Adicionar gestor” no cartão da empresa.</p>}
              {result.manager && (
                <dl className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800">
                  <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Empresa</dt><dd className="font-semibold text-right">{result.companyName}</dd></div>
                  <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Usuário</dt><dd className="font-semibold">{result.manager.username}</dd></div>
                  <div className="flex justify-between gap-3 px-3 py-2"><dt className="text-slate-500">Senha do 1º acesso</dt><dd className="tabular-nums font-semibold">{result.manager.password}</dd></div>
                </dl>
              )}
              {result.manager && <p className="text-xs text-slate-500">{result.manager.isBirthDefault ? 'Senha padrão: data de nascimento + inicial do nome. ' : ''}O sistema obriga a troca no primeiro login. Esta senha não fica visível depois: copie agora.</p>}
              <div className="flex justify-end"><CopyButton text={credentialsText(result)} label="Copiar dados para enviar" /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
