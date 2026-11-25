import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UFS, isValidCNPJ, isValidCPF, isValidPhone, maskCNPJ, maskCPF, maskPhone, onlyDigits } from '@/lib/brDocs';
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import { BrandAppIcon } from '@/components/BrandMark';
import { normalize, suggestUsername } from '@/lib/format';

// Categoria → conselho, CBO sugerido e áreas mais comuns (o hospital pode ter outras).
const CATEGORIES = [
  { id: 'medico', label: 'Médico(a)', council: 'CRM', cbo: '225125', area: 'Especialidade', rqe: true,
    areas: ['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia', 'Anestesiologia', 'Ortopedia e Traumatologia',
      'Cardiologia', 'Medicina Intensiva', 'Medicina de Emergência', 'Neonatologia', 'Neurologia', 'Psiquiatria', 'Radiologia',
      'Medicina de Família e Comunidade', 'Infectologia', 'Nefrologia'] },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', council: 'COREN', cbo: '223505', area: 'Área de atuação',
    areas: ['Enfermagem Geral', 'Terapia Intensiva', 'Urgência e Emergência', 'Centro Cirúrgico', 'Obstetrícia', 'Neonatologia', 'Pediatria'] },
  { id: 'tecnico_enfermagem', label: 'Téc. de Enfermagem', council: 'COREN', cbo: '322205', area: 'Área de atuação',
    areas: ['Técnico de Enfermagem', 'Terapia Intensiva', 'Urgência e Emergência', 'Centro Cirúrgico'] },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', council: 'CREFITO', cbo: '223605', area: 'Área de atuação',
    areas: ['Fisioterapia Intensiva', 'Fisioterapia Respiratória', 'Fisioterapia Motora', 'Fisioterapia Neonatal'] },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', council: 'CRF', cbo: '223405', area: 'Área de atuação',
    areas: ['Farmácia Hospitalar', 'Farmácia Clínica'] },
  { id: 'nutricionista', label: 'Nutricionista', council: 'CRN', cbo: '223710', area: 'Área de atuação',
    areas: ['Nutrição Clínica', 'Terapia Nutricional'] },
  { id: 'psicologo', label: 'Psicólogo(a)', council: 'CRP', cbo: '251510', area: 'Área de atuação',
    areas: ['Psicologia Hospitalar'] },
  { id: 'biomedico', label: 'Biomédico(a)', council: 'CRBM', cbo: '221205', area: 'Área de atuação',
    areas: ['Análises Clínicas', 'Imagem'] }
];

const PIX_TYPES = [
  { id: 'CPF', label: 'CPF' }, { id: 'CNPJ', label: 'CNPJ' }, { id: 'Email', label: 'E-mail' },
  { id: 'Telefone', label: 'Telefone' }, { id: 'Aleatoria', label: 'Chave aleatória' }
];

const STEPS = ['Você', 'Registro profissional', 'Recebimento'];

const EMPTY = {
  name: '', cpf: '', birth_date: '', phone: '', email: '', username: '',
  category: 'medico', council_number: '', council_uf: '', document_expiry: '', specialty: '', rqe: '', cbo: '225125',
  receipt_type: 'pf', cnpj: '', legal_name: '', pix_type: 'CPF', pix_key: '', bank_info: '', lgpd: false
};

// Chave PIX sugerida a partir do que a pessoa já informou.
function pixFrom(form, type) {
  if (type === 'CPF') return form.cpf;
  if (type === 'CNPJ') return form.cnpj;
  if (type === 'Email') return form.email;
  if (type === 'Telefone') return form.phone;
  return '';
}

const selectClass = 'h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40';
const inputClass = 'h-11 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm';

// Mesma área com outra terminação ("Cardiologista" × "Cardiologia", "Cirurgião" × "Cirurgia").
const areaStem = text => normalize(text).split(/\s+/).map(w => w.replace(/(ista|iao|ia|ao|o|a)$/, '')).join(' ');

// Nomes que o hospital já usa vêm sem categoria confiável: encaixa pelo nome. A ordem importa
// ("técnico de enfermagem" antes de "enfermagem", "análises clínicas" antes de "clínica").
// O que não parece área de saúde (ex.: "Administrativo") fica de fora.
const AREA_KEYWORDS = [
  ['tecnico_enfermagem', ['tecnic']],
  ['enfermeiro', ['enferm']],
  ['fisioterapeuta', ['fisio']],
  ['farmaceutico', ['farmac']],
  ['nutricionista', ['nutri']],
  ['psicologo', ['psicolog']],
  ['biomedico', ['biomed', 'analises', 'laborat']],
  ['medico', ['medic', 'clinic', 'cirurg', 'cardio', 'pediat', 'obstet', 'gineco', 'materni', 'anestes', 'ortoped', 'traumat',
    'neuro', 'psiquiat', 'radiolog', 'intensiv', 'emergen', 'infect', 'nefro', 'neonat', 'urolog', 'gastro', 'pneumo',
    'endocrin', 'dermat', 'oftalm', 'otorrino', 'oncolog', 'hematolog', 'geriatr', 'reumat', 'familia', 'plantonista']]
];

function categoryOfArea(name) {
  const n = normalize(name);
  const hit = AREA_KEYWORDS.find(([, words]) => words.some(w => n.includes(w)));
  return hit ? hit[0] : null;
}

// Seletor de especialidade / área: opções só da categoria escolhida, em botões.
function AreaPicker({ hospitalName, own, common, value, onChange }) {
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const all = [...own, ...common];
  const isCustom = Boolean(value) && !all.some(a => normalize(a) === normalize(value));
  const q = normalize(query);
  const filter = list => (q ? list.filter(a => normalize(a).includes(q)) : list);
  const chip = (a) => {
    const selected = normalize(a) === normalize(value);
    return (
      <button key={a} type="button" onClick={() => { setTyping(false); onChange(a); }} aria-pressed={selected}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${selected
          ? 'border-sky-600 bg-sky-600 text-white'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-sky-400'}`}>
        {selected && <Check className="w-3.5 h-3.5" />} {a}
      </button>
    );
  };
  const ownShown = filter(own);
  const commonShown = filter(common);
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 space-y-3">
      {all.length > 8 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar" className="h-10 pl-9 rounded-xl text-sm" />
        </div>
      )}
      {ownShown.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500">Usadas em {hospitalName || 'este hospital'}</p>
          <div className="flex flex-wrap gap-2">{ownShown.map(chip)}</div>
        </div>
      )}
      {commonShown.length > 0 && (
        <div className="space-y-2">
          {ownShown.length > 0 && <p className="text-[11px] font-semibold text-slate-500">Outras</p>}
          <div className="flex flex-wrap gap-2">{commonShown.map(chip)}</div>
        </div>
      )}
      {ownShown.length + commonShown.length === 0 && <p className="text-xs text-slate-500">Nada encontrado com “{query}”.</p>}
      {typing || isCustom ? (
        <Input autoFocus value={value} onChange={e => onChange(e.target.value)} placeholder="Digite a sua" className="h-10 rounded-xl text-sm" />
      ) : (
        <button type="button" onClick={() => { setTyping(true); onChange(''); }}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <Plus className="w-3.5 h-3.5" /> Outra
        </button>
      )}
    </div>
  );
}

// Aceita o código ou o link inteiro colado no campo (…/register?empresa=código).
function extractHospitalCode(value) {
  const text = String(value || '').trim();
  const fromLink = text.match(/[?&]empresa=([^&#\s]+)/i);
  return (fromLink ? decodeURIComponent(fromLink[1]) : text).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}{required && <span className="text-rose-500"> *</span>}</Label>
      {children}
      {error ? <p className="text-[11px] font-semibold text-rose-600">{error}</p> : hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [pixTouched, setPixTouched] = useState(false);

  // Cada empresa tem o seu link de credenciamento (/register?empresa=código). Sem o link, a
  // pessoa digita o código que a coordenação passou.
  const [hospitalCode, setHospitalCode] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('empresa') || ''; } catch { return ''; }
  });
  const [hospital, setHospital] = useState(null); // { name, specialties }
  const [codeFromLink] = useState(() => Boolean(hospitalCode));

  useEffect(() => {
    const code = extractHospitalCode(hospitalCode);
    setHospital(null);
    if (code.length < 6) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('registration_company', { p_code: code });
      if (!cancelled) setHospital(data?.name ? data : null);
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hospitalCode]);

  const category = CATEGORIES.find(c => c.id === form.category) || CATEGORIES[0];
  // Só as da categoria escolhida: primeiro as que o hospital já usa (as do Mural), depois as comuns.
  const areaOptions = useMemo(() => {
    const names = (Array.isArray(hospital?.specialties) ? hospital.specialties : []).map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean);
    const own = [...new Map(names.filter(n => categoryOfArea(n) === category.id).map(n => [normalize(n), n])).values()];
    const ownKeys = new Set(own.map(areaStem));
    return { own, common: category.areas.filter(a => !ownKeys.has(areaStem(a))) };
  }, [hospital, category]);

  const set = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && !usernameTouched) next.username = suggestUsername(value);
      if (key === 'category') {
        const cat = CATEGORIES.find(c => c.id === value);
        if (!prev.cbo || prev.cbo === category.cbo) next.cbo = cat.cbo;
        if (!cat.rqe) next.rqe = '';
        if (value !== prev.category) next.specialty = '';
      }
      if (key === 'receipt_type') {
        next.pix_type = value === 'pj' ? 'CNPJ' : 'CPF';
        if (!pixTouched) next.pix_key = pixFrom(next, next.pix_type);
      }
      if (key === 'pix_type' && !pixTouched) next.pix_key = pixFrom(next, value);
      if (['cpf', 'cnpj', 'email', 'phone'].includes(key) && !pixTouched) next.pix_key = pixFrom(next, next.pix_type);
      return next;
    });
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = index => {
    const e = {};
    if (index === 0) {
      if (!hospital) e.hospital = 'Informe o código do hospital (está no link enviado pela coordenação).';
      if (form.name.trim().split(/\s+/).length < 2) e.name = 'Informe o nome completo.';
      if (!isValidCPF(form.cpf)) e.cpf = 'CPF inválido. Confira os números.';
      if (!form.birth_date) e.birth_date = 'Informe a data de nascimento.';
      if (!isValidPhone(form.phone)) e.phone = 'Telefone com DDD, ex.: (21) 98765-4321.';
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'E-mail inválido.';
      if (form.username.replace(/[^a-z0-9.]/g, '').length < 3) e.username = 'Escolha um usuário com pelo menos 3 letras.';
    }
    if (index === 1) {
      if (!onlyDigits(form.council_number)) e.council_number = `Informe o número do ${category.council}.`;
      if (!form.council_uf) e.council_uf = 'Escolha o estado.';
      if (!form.specialty.trim()) e.specialty = `Escolha a ${category.area.toLowerCase()}.`;
    }
    if (index === 2) {
      if (form.receipt_type === 'pj') {
        if (!isValidCNPJ(form.cnpj)) e.cnpj = 'CNPJ inválido. Confira os números.';
        if (!form.legal_name.trim()) e.legal_name = 'Informe a razão social.';
      }
      if (!form.pix_key.trim() && !form.bank_info.trim()) e.pix_key = 'Informe a chave PIX ou os dados bancários.';
      if (!form.lgpd) e.lgpd = 'É preciso aceitar para enviar a ficha.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate(step)) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const back = () => { setErrors({}); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < STEPS.length - 1) return next();
    if (!validate(step)) return;
    setError('');
    setLoading(true);
    try {
      const cleanUsername = form.username.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
      const finalEmail = form.email.trim() ? form.email.trim().toLowerCase() : `${cleanUsername}.${Date.now()}@scalemedic.local`;
      const councilNumber = onlyDigits(form.council_number);
      const payload = {
        name: form.name.trim(),
        specialty: form.specialty.trim(),
        rqe: form.rqe.trim(),
        cbo: form.cbo.trim(),
        cpf: form.cpf,
        birth_date: form.birth_date,
        document: `${councilNumber} - ${form.council_uf}`,
        document_uf: form.council_uf,
        document_expiry: form.document_expiry,
        phone: form.phone,
        email: finalEmail,
        // status "pendente": quem define é o banco
        data: {
          category: form.category,
          council: category.council,
          council_uf: form.council_uf,
          username: cleanUsername, // usuário desejado, aparece na aba "Pendentes"
          birth_date: form.birth_date,
          cpf: form.cpf,
          rqe: form.rqe.trim(),
          cbo: form.cbo.trim(),
          receipt_type: form.receipt_type,
          ...(form.receipt_type === 'pj' ? { cnpj: form.cnpj, legal_name: form.legal_name.trim() } : {}),
          pix_type: form.pix_type,
          pix_key: form.pix_key.trim(),
          bank_info: form.bank_info.trim(),
          lgpd_consent: true
        }
      };

      const { error: insertErr } = await supabase.rpc('submit_registration', { p_code: extractHospitalCode(hospitalCode), p_payload: payload });
      if (insertErr) throw insertErr;
      setSuccess(true);
    } catch (err) {
      setError(/hospital|nome completo|LGPD/i.test(err?.message || '') ? err.message : 'Não foi possível enviar a ficha. Confira se o CPF ou o e-mail já não estão cadastrados e tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center p-4 py-8 sm:py-12 font-sans">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200/10 rounded-3xl p-5 sm:p-10 shadow-sm">
        {success ? (
          <div className="flex flex-col items-center text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ficha enviada!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Seus dados chegaram à coordenação de <b className="text-slate-700 dark:text-slate-200">{hospital?.name || 'seu hospital'}</b>. Assim que o cadastro for aprovado, você recebe o usuário e a senha para entrar.
            </p>
            <Link to="/login" className="pt-4">
              <Button className="h-11 px-8 rounded-xl font-semibold">Ir para a tela de entrada</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-7">
            <div className="flex items-center gap-3">
              <BrandAppIcon size={44} />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Credenciamento profissional</h1>
                <p className="text-xs sm:text-sm text-slate-500 truncate">
                  {hospital ? <>Para <b className="text-slate-700 dark:text-slate-200">{hospital.name}</b> · leva uns 3 minutos</> : 'Leva uns 3 minutos. A coordenação confere e libera seu acesso.'}
                </p>
              </div>
            </div>

            {!(codeFromLink && hospital) && (
              <Field label="Código do hospital" required error={errors.hospital}
                hint={hospital ? `Hospital: ${hospital.name}` : extractHospitalCode(hospitalCode).length >= 6 ? 'Código não encontrado.' : 'Cole o link enviado pela coordenação ou só o código.'}>
                <Input value={hospitalCode} onChange={e => { setHospitalCode(e.target.value); setErrors(p => ({ ...p, hospital: undefined })); }} className={inputClass} autoComplete="off" />
              </Field>
            )}

            {/* Etapas */}
            <ol className="grid grid-cols-3 gap-2" aria-label="Etapas">
              {STEPS.map((label, i) => (
                <li key={label} className="space-y-1.5">
                  <div className={`h-1.5 rounded-full ${i <= step ? 'bg-sky-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  <p className={`text-[11px] font-semibold flex items-center gap-1 ${i === step ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}.</span>} {label}
                  </p>
                </li>
              ))}
            </ol>

            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
                  <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Como está no documento" className={inputClass} autoComplete="name" />
                </Field>
                <Field label="CPF" required error={errors.cpf}>
                  <Input value={form.cpf} onChange={e => set('cpf', maskCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="Data de nascimento" required error={errors.birth_date}>
                  <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} className={inputClass} autoComplete="bday" />
                </Field>
                <Field label="Celular / WhatsApp" required error={errors.phone}>
                  <Input value={form.phone} onChange={e => set('phone', maskPhone(e.target.value))} placeholder="(00) 90000-0000" inputMode="tel" className={inputClass} autoComplete="tel" />
                </Field>
                <Field label="E-mail" error={errors.email} hint="Opcional, mas ajuda a recuperar o acesso.">
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="voce@email.com" className={inputClass} autoComplete="email" />
                </Field>
                <Field label="Usuário para entrar no sistema" required error={errors.username} hint="Sugerido pelo seu nome. Pode trocar." className="sm:col-span-2">
                  <Input value={form.username} onChange={e => { setUsernameTouched(true); set('username', e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '')); }} placeholder="nome.sobrenome" className={`${inputClass} sm:w-72`} autoCapitalize="none" />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Field label="Categoria" required>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.id} type="button" onClick={() => set('category', cat.id)} aria-pressed={form.category === cat.id}
                        className={`rounded-xl border px-2 py-2.5 text-center text-xs transition-colors ${form.category === cat.id
                          ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 font-bold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'}`}>
                        {cat.label}
                        <span className="block text-[10px] font-normal opacity-60">{cat.council}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label={`Número do ${category.council}`} required error={errors.council_number}>
                    <Input value={form.council_number} onChange={e => set('council_number', e.target.value.replace(/[^\dA-Za-z-]/g, ''))} placeholder="Ex.: 123456" inputMode="numeric" className={inputClass} />
                  </Field>
                  <Field label="Estado" required error={errors.council_uf}>
                    <select value={form.council_uf} onChange={e => set('council_uf', e.target.value)} className={selectClass}>
                      <option value="">UF</option>
                      {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </Field>
                  <Field label="Validade do registro" hint="Se a carteira tiver validade." className="col-span-2 sm:col-span-1">
                    <Input type="date" value={form.document_expiry} onChange={e => set('document_expiry', e.target.value)} className={inputClass} />
                  </Field>
                </div>
                <Field label={category.area} required error={errors.specialty} hint="É por ela que você vê as vagas certas no Mural.">
                  <AreaPicker key={category.id} hospitalName={hospital?.name} own={areaOptions.own} common={areaOptions.common}
                    value={form.specialty} onChange={v => set('specialty', v)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  {category.rqe && (
                    <Field label="RQE" hint="Registro de especialista, se tiver.">
                      <Input value={form.rqe} onChange={e => set('rqe', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputClass} />
                    </Field>
                  )}
                  <Field label="CBO" hint="Já preenchido pela categoria.">
                    <Input value={form.cbo} onChange={e => set('cbo', e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className={inputClass} />
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Field label="Recebo como" required>
                  <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
                    {[['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica (CNPJ)']].map(([id, label]) => (
                      <button key={id} type="button" onClick={() => set('receipt_type', id)} aria-pressed={form.receipt_type === id}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold ${form.receipt_type === id ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                {form.receipt_type === 'pj' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="CNPJ" required error={errors.cnpj}>
                      <Input value={form.cnpj} onChange={e => set('cnpj', maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" className={inputClass} />
                    </Field>
                    <Field label="Razão social" required error={errors.legal_name}>
                      <Input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} placeholder="Nome da empresa" className={inputClass} />
                    </Field>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Tipo de chave PIX">
                    <select value={form.pix_type} onChange={e => set('pix_type', e.target.value)} className={selectClass}>
                      {PIX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Chave PIX" error={errors.pix_key} className="sm:col-span-2">
                    <Input value={form.pix_key} onChange={e => { setPixTouched(true); set('pix_key', e.target.value); }} className={inputClass} autoComplete="off" />
                  </Field>
                </div>
                <Field label="Dados bancários" hint="Só se não receber por PIX. Ex.: Banco, agência e conta.">
                  <Input value={form.bank_info} onChange={e => set('bank_info', e.target.value)} placeholder="Banco Itaú, agência 0000, conta 00000-0" className={inputClass} />
                </Field>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 cursor-pointer">
                    <input type="checkbox" checked={form.lgpd} onChange={e => set('lgpd', e.target.checked)} className="mt-0.5 h-4 w-4 accent-sky-600" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Autorizo o uso dos meus dados para cadastro, escalas e pagamentos, conforme os{' '}
                      <Link to="/termos-de-uso" target="_blank" className="font-semibold text-sky-600 underline">Termos de Uso e LGPD</Link>.
                    </span>
                  </label>
                  {errors.lgpd && <p className="text-[11px] font-semibold text-rose-600">{errors.lgpd}</p>}
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
              {step === 0 ? (
                <Link to="/login"><Button type="button" variant="ghost" className="h-11 text-xs font-semibold text-slate-500"><ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao login</Button></Link>
              ) : (
                <Button type="button" variant="ghost" onClick={back} className="h-11 text-xs font-semibold text-slate-500"><ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar</Button>
              )}
              <Button type="submit" disabled={loading} className="h-11 px-6 sm:px-8 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  : step < STEPS.length - 1 ? <>Continuar <ArrowRight className="w-4 h-4 ml-1.5" /></> : 'Enviar ficha'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
