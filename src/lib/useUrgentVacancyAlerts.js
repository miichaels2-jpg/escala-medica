import { useEffect } from 'react';
import { findUrgentAlerts, urgentAlertKey } from '@/lib/urgentVacancies';
import { recipientFor, sendNotifications } from '@/lib/notifications';
import { isVacancyRelevantFor } from '@/components/NotificationCenter';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const LAST_RUN_KEY = 'scale_urgent_alerts_last_run';
let running = false;

function formatDateBR(value) {
  const [y, m, d] = String(value || '').slice(0, 10).split('-');
  return d ? `${d}/${m}` : '';
}

// Alerta de furo iminente. Não há servidor rodando em segundo plano: qualquer
// aparelho logado com o app aberto confere as vagas a cada 5 minutos e avisa os
// profissionais compatíveis e livres. A chave única no banco (dedupe_key) garante
// um aviso por profissional e por vaga, mesmo com vários aparelhos abertos.
export function useUrgentVacancyAlerts({ enabled, companyId, shifts, professionals, sectors, units }) {
  useEffect(() => {
    if (!enabled || !companyId) return undefined;

    const run = async () => {
      if (running || document.visibilityState !== 'visible') return;
      // Só confere com os dados carregados; senão marcaria a conferência como feita à toa.
      if (!(shifts || []).length || !(professionals || []).length) return;
      let lastRun = 0;
      try { lastRun = Number(window.localStorage.getItem(LAST_RUN_KEY) || 0); } catch { /* sem armazenamento */ }
      if (Date.now() - lastRun < CHECK_EVERY_MS) return;
      running = true;
      try {
        try { window.localStorage.setItem(LAST_RUN_KEY, String(Date.now())); } catch { /* sem armazenamento */ }
        const alerts = findUrgentAlerts({ shifts, professionals, isRelevant: isVacancyRelevantFor });
        if (alerts.length === 0) return;
        const sectorName = id => (sectors || []).find(s => String(s.id) === String(id))?.name || 'Setor';
        const unitName = id => (units || []).find(u => String(u.id) === String(id))?.name || '';
        await sendNotifications(alerts.map(({ shift, professional, urgency }) => ({
          ...recipientFor(professional),
          company_id: companyId,
          unit_id: shift.unit_id,
          type: 'vaga_urgente',
          category: 'vaga',
          title: `Vaga urgente: ${sectorName(shift.sector_id)} ${formatDateBR(shift.date)} ${shift.start_time}`,
          message: `${unitName(shift.unit_id) ? `${unitName(shift.unit_id)} · ` : ''}${shift.start_time}–${shift.end_time} · ${urgency.label}. Abra o Mural para assumir.`,
          data: { shift_id: shift.id, date: shift.date },
          dedupe_key: urgentAlertKey(shift, professional)
        })));
      } finally {
        running = false;
      }
    };

    run();
    const timer = window.setInterval(run, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [enabled, companyId, shifts, professionals, sectors, units]);
}
