import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { TERMS_VERSION } from '@/lib/terms';

// "Seus dados (LGPD)" na Minha Escala: quando aceitou os termos, baixar os próprios dados
// e pedir a exclusão (vai para os gestores, que respondem em até 15 dias).

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PrivacyCard({ user, professional }) {
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('privacy_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setEvents(Array.isArray(data) ? data : []);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const openRequest = events.find(e => e.kind === 'exclusao_pedida' && e.status === 'aberto');
  const lastDone = events.find(e => e.kind === 'exclusao_pedida' && e.status === 'atendido');

  const downloadMyData = async () => {
    setBusy('baixar'); setMessage('');
    try {
      const profIds = [professional?.id, user?.data?.professional_id].filter(Boolean).map(String);
      const [me, profs, shifts, notifications] = await Promise.all([
        supabase.from('users').select('id, username, email, full_name, role, data, created_date').eq('id', user.id).maybeSingle(),
        profIds.length ? supabase.from('professionals').select('*').in('id', profIds) : Promise.resolve({ data: [] }),
        profIds.length ? supabase.from('shifts').select('id, date, start_time, end_time, status, sector_id, unit_id, target_specialty, notes').in('professional_id', profIds).order('date') : Promise.resolve({ data: [] }),
        supabase.from('notifications').select('title, message, type, created_date, read').eq('user_id', user.id).order('created_date', { ascending: false }).limit(500)
      ]);
      const payload = {
        gerado_em: new Date().toISOString(),
        aviso: 'Cópia dos seus dados pessoais guardados no ScaleMedic (LGPD, art. 18).',
        conta: me.data || null,
        cadastro_profissional: profs.data || [],
        plantoes: shifts.data || [],
        notificacoes: notifications.data || [],
        registros_de_privacidade: events
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-scalemedic-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('Não foi possível gerar o arquivo agora. Tente de novo.');
    } finally { setBusy(''); }
  };

  const requestDeletion = async () => {
    const note = window.prompt('Pedir a exclusão dos seus dados pessoais?\n\nOs gestores do hospital recebem o pedido e respondem em até 15 dias. Dados que a lei obriga a guardar (ex.: registros de plantões já pagos) podem ser mantidos pelo prazo legal.\n\nSe quiser, escreva o motivo:', '');
    if (note === null) return;
    setBusy('excluir'); setMessage('');
    try {
      const { error } = await supabase.rpc('request_data_deletion', { p_note: note || null });
      if (error) throw error;
      await load();
      setMessage('Pedido enviado aos gestores.');
    } catch {
      setMessage('Não foi possível enviar o pedido agora. Tente de novo.');
    } finally { setBusy(''); }
  };

  const acceptedAt = user?.data?.lgpd_accepted_at;
  const acceptedVersion = user?.data?.lgpd_terms_version || (user?.data?.lgpd_accepted ? '1' : '');

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Seus dados (LGPD)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {acceptedVersion
              ? `Você aceitou os termos (versão ${acceptedVersion}${acceptedVersion !== TERMS_VERSION ? `, a vigente é a ${TERMS_VERSION}` : ''})${acceptedAt ? ` em ${formatDateTime(acceptedAt)}` : ''}.`
              : 'Você ainda não aceitou os termos de uso.'}{' '}
            <Link to="/termos-de-uso" className="text-sky-700 dark:text-sky-300 hover:underline">Ler os termos</Link>
          </p>
          {openRequest && (
            <p className="mt-2 text-sm rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 px-3 py-2">
              Pedido de exclusão enviado em {formatDateTime(openRequest.created_at)}. Os gestores respondem em até 15 dias.
            </p>
          )}
          {!openRequest && lastDone && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Último pedido de exclusão atendido em {formatDateTime(lastDone.handled_at)}.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadMyData} disabled={Boolean(busy)} className="h-9 rounded-xl text-sm gap-1.5 cursor-pointer">
              {busy === 'baixar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar meus dados
            </Button>
            {!openRequest && (
              <Button type="button" variant="outline" onClick={requestDeletion} disabled={Boolean(busy)} className="h-9 rounded-xl text-sm gap-1.5 cursor-pointer text-rose-700 dark:text-rose-300">
                {busy === 'excluir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Pedir exclusão dos meus dados
              </Button>
            )}
          </div>
          {message && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
        </div>
      </div>
    </section>
  );
}
