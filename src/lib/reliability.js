// Ranking de confiabilidade (só gestão): quem cumpre a própria escala, quem cobre
// vagas dos colegas e quem mais repassa plantões. Usa só o que o sistema registra
// nos plantões (marcas do Mural) e nas trocas diretas aprovadas.
import { getShiftDateTimeRange, isShiftVacant } from './shiftLiveStatus.js';

const norm = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tag = (notes, name) => String(notes || '').match(new RegExp(`\\[${name}:\\s*([^\\]]+)\\]`, 'i'))?.[1]?.trim() || '';

function hoursOf(shift) {
  const range = getShiftDateTimeRange(shift);
  return range ? (range.end - range.start) / 3600000 : 0;
}

// shifts: plantões do período (já filtrados por unidade/setor/datas).
// swaps: pedidos de troca direta (shift_swaps) — contam os aprovados dentro do período.
export function computeReliability({ shifts, professionals, swaps = [], start = '', end = '', now = new Date() }) {
  const active = (shifts || []).filter(s => s && !norm(s.status).includes('cancel'));
  const inPeriod = date => (!start || String(date) >= start) && (!end || String(date) <= end);

  return (professionals || [])
    .filter(p => p?.id)
    .map(prof => {
      const id = String(prof.id);
      const name = norm(prof.name);
      const mine = active.filter(s => String(s.professional_id) === id && !isShiftVacant(s));
      const covered = mine.filter(s => {
        const notes = String(s.notes || '');
        return norm(tag(notes, 'ASSUNCAO_DIRETA')) === name || norm(tag(notes, 'TRANSFER_TO')) === name;
      });
      // Repasses: plantões que eram dela e foram para o Mural (já assumidos por outro, vagos ou aguardando).
      const released = active.filter(s => {
        if (String(s.professional_id) === id && !isShiftVacant(s) && !String(s.notes || '').includes('[AGUARDANDO_GESTOR]')) return false;
        const notes = String(s.notes || '');
        return tag(notes, 'SOLICITADO_ID') === id || norm(tag(notes, 'ORIGEM_MURAL')) === name ||
          norm(tag(notes, 'TRANSFERENCIA').split('->')[0]) === name;
      });
      const done = mine.filter(s => { const r = getShiftDateTimeRange(s); return r && r.end <= now; });
      const directSwaps = (swaps || []).filter(sw => sw?.swap_type === 'troca_direta' && sw.status === 'aprovada' &&
        (String(sw.requester_professional_id) === id || String(sw.target_professional_id) === id) &&
        (inPeriod(sw.shift_date) || inPeriod(sw.target_shift_date))).length;

      // Compromissos = plantões originalmente dela (os que ficou com eles sem ter vindo do Mural + os que repassou).
      // Pedido de repasse em análise conta só como repasse (não como plantão mantido).
      const pendingRelease = mine.filter(s => String(s.notes || '').includes('[AGUARDANDO_GESTOR]') && released.includes(s)).length;
      const kept = mine.length - covered.length - pendingRelease;
      const commitments = kept + released.length;
      return {
        id,
        name: prof.name || 'Profissional',
        specialty: prof.specialty || '',
        scheduled: mine.length,
        done: done.length,
        hours: Math.round(done.reduce((sum, s) => sum + hoursOf(s), 0)),
        covered: covered.length,
        released: released.length,
        directSwaps,
        index: commitments > 0 ? Math.round((kept / commitments) * 100) : null
      };
    })
    .filter(row => row.scheduled > 0 || row.released > 0)
    .sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || b.covered - a.covered || b.done - a.done || a.name.localeCompare(b.name, 'pt-BR'));
}
