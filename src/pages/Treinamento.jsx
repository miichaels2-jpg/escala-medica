import { useEffect, useState } from 'react';
import { BookOpen, Download, ExternalLink } from 'lucide-react';
import PageHero from '@/components/PageHero';
import { supabase } from '@/lib/supabase';

// Material de treinamento (só o dono da plataforma): os manuais em PDF de cada tela,
// gerados por scripts/manual (public/manual). Servem para treinar a equipe dos clientes.
const pdf = id => `/manual/${id}.pdf`;

function ManualCard({ id, kicker, title, summary, audience, highlight }) {
  return (
    <article className={`flex flex-col rounded-2xl border p-5 bg-white dark:bg-slate-900 ${highlight ? 'border-sky-300 dark:border-sky-700' : 'border-slate-200 dark:border-slate-800'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">{kicker}</p>
      <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 flex-1">{summary}</p>
      {audience && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Para: {audience}</p>}
      <div className="mt-4 flex gap-2">
        <a href={pdf(id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          <ExternalLink className="w-4 h-4" /> Abrir
        </a>
        <a href={pdf(id)} download={`ScaleMedic - ${title}.pdf`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white">
          <Download className="w-4 h-4" /> Baixar PDF
        </a>
      </div>
    </article>
  );
}

export default function Treinamento() {
  const [isOwner, setIsOwner] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('sm_auth_is_platform_owner').then(({ data }) => { if (!cancelled) setIsOwner(data === true); });
    fetch('/manual/catalogo.json', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(res.status))))
      .then(data => { if (!cancelled) setCatalog(data); })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar a lista de manuais.'); });
    return () => { cancelled = true; };
  }, []);

  if (isOwner === false) {
    return (
      <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 text-slate-900 dark:text-slate-100">
        <p className="text-sm text-slate-500">Esta área é restrita ao dono da plataforma.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 space-y-6 text-slate-900 dark:text-slate-100">
      <PageHero
        title="Material de treinamento"
        subtitle={catalog ? `Manuais em PDF de cada tela, com passo a passo e fotos · versão V${catalog.versao}, atualizados em ${catalog.atualizado}.` : 'Manuais em PDF de cada tela, com passo a passo e fotos.'}
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {catalog && (
        <>
          <ManualCard id="manual-completo" kicker="Todos os módulos" title="Manual completo do ScaleMedic" summary="Todas as telas em um só PDF, da primeira entrada ao fechamento do mês." audience="Gestão, faturamento e plantonistas" highlight />
          <section className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-slate-500" /> Por módulo</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {catalog.manuais.map(m => (
                <ManualCard key={m.id} id={m.id} kicker={`Módulo ${m.numero}`} title={m.titulo} summary={m.resumo} audience={m.publico} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
