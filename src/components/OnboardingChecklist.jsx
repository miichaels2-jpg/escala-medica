import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, PlayCircle, X } from 'lucide-react';

// "Primeiros passos" no Painel: guia a empresa nova até a primeira escala publicada.
// Cada passo se marca sozinho pelos dados da empresa; a lista some quando tudo estiver feito
// ou quando o gestor ocultar (fica guardado neste navegador).
function hiddenKey(companyId) { return `sm-primeiros-passos-ocultos-${companyId || 'empresa'}`; }

export default function OnboardingChecklist({ companyId, user, units = [], sectors = [], professionals = [], shifts = [], publishedRanges = {} }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => {
    try { return window.localStorage.getItem(hiddenKey(companyId)) === '1'; } catch { return false; }
  });

  // O próprio gestor não conta como equipe.
  const team = professionals.filter(p => String(p.user_id || '') !== String(user?.id || '-') && String(p.id) !== String(user?.data?.professional_id || '-'));
  const hasPublished = Object.values(publishedRanges || {}).some(r => Array.isArray(r) ? r.length > 0 : !!r);

  const steps = [
    { id: 'hospital', done: units.length > 0 && units.every(u => u.cnpj), title: 'Completar os dados do hospital', hint: 'Nome, CNPJ, telefone e logomarca saem nos relatórios.', path: '/configuracoes' },
    { id: 'setores', done: sectors.length > 0, title: 'Cadastrar os setores', hint: 'UTI, Emergência, Enfermaria… cada setor tem a sua escala.', path: '/setores', video: 'montar-mes' },
    { id: 'equipe', done: team.length > 0, title: 'Trazer a equipe', hint: 'Cadastre os profissionais ou mande o link de cadastro (botão “Convidar equipe”).', path: '/corpo-clinico' },
    { id: 'escala', done: shifts.length > 0, title: 'Montar a primeira escala', hint: 'Lance os plantões do mês na grade.', path: '/escalas', video: 'escalar-pela-grade' },
    { id: 'publicar', done: hasPublished, title: 'Publicar a escala', hint: 'Depois de publicada, cada profissional vê os seus plantões no celular.', path: '/escalas', video: 'publicar-escala' }
  ];
  const doneCount = steps.filter(s => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  const next = steps.find(s => !s.done);

  const hide = () => {
    try { window.localStorage.setItem(hiddenKey(companyId), '1'); } catch { /* navegador sem armazenamento: some só nesta visita */ }
    setHidden(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Primeiros passos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{doneCount} de {steps.length} concluídos. Falta pouco para a equipe receber a escala no celular.</p>
        </div>
        <button type="button" onClick={hide} aria-label="Ocultar primeiros passos" title="Ocultar" className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {steps.map((step, i) => {
          const isNext = step === next;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => navigate(step.path)}
                className={`w-full flex items-center gap-3 py-3 text-left cursor-pointer group ${step.done ? 'opacity-60' : ''}`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  step.done ? 'bg-emerald-600 text-white' : isNext ? 'bg-sky-600 text-white' : 'border border-slate-300 dark:border-slate-700 text-slate-500'
                }`}>
                  {step.done ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-medium ${step.done ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>{step.title}</span>
                  {!step.done && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.hint}</span>}
                </span>
                {!step.done && (
                  <span className={`shrink-0 flex items-center gap-1 text-sm font-medium ${isNext ? 'text-sky-700 dark:text-sky-300' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    <span className={isNext ? '' : 'hidden sm:inline'}>{isNext ? 'Começar' : 'Abrir'}</span> <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
              {!step.done && step.video && (
                <button type="button" onClick={() => navigate(`/como-usar#${step.video}`)} className="ml-10 -mt-1.5 mb-3 inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline cursor-pointer">
                  <PlayCircle className="w-3.5 h-3.5" /> Ver como fazer
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
