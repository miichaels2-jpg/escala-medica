// Frases legíveis para o histórico de alterações (tabela audit_log).

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function br(date) {
  const [y, m, d] = String(date || '').slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : '';
}

function shiftLabel(row, ctx) {
  if (!row) return 'plantão';
  const sector = ctx.sectorName?.(row.sector_id);
  return `plantão de ${br(row.date)} ${row.start_time || ''}–${row.end_time || ''}${sector ? ` · ${sector}` : ''}`.trim();
}

function personName(row, ctx) {
  if (!row?.professional_id && !row?.professional_name) return '';
  return ctx.professionalName?.(row.professional_id) || row.professional_name || 'profissional';
}

// Alterações só em observações internas (ex.: marcas de publicação gravadas em
// cada plantão) não interessam no histórico: a publicação já tem registro próprio.
export function isInternalOnly(entry) {
  if (entry?.table_name !== 'shifts' || entry?.action !== 'update') return false;
  const fields = (entry.changed_fields || []).filter(field => !['updated_date', 'updated_at'].includes(field));
  return fields.length > 0 && fields.every(field => field === 'notes');
}

export function describeAuditEntry(entry, ctx = {}) {
  const before = entry?.old_data || null;
  const after = entry?.new_data || null;

  if (entry?.table_name === 'shifts') {
    const row = after || before;
    if (entry.action === 'insert') {
      const who = personName(after, ctx);
      return `Criou ${shiftLabel(row, ctx)}${who ? ` para ${who}` : ' (vaga aberta)'}`;
    }
    if (entry.action === 'delete') return `Excluiu ${shiftLabel(row, ctx)}${personName(before, ctx) ? ` (${personName(before, ctx)})` : ''}`;

    const fields = entry.changed_fields || [];
    const parts = [];
    if (fields.includes('professional_id') || fields.includes('professional_name')) {
      const from = personName(before, ctx);
      const to = personName(after, ctx);
      if (!from && to) parts.push(`alocou ${to}`);
      else if (from && !to) parts.push(`liberou o plantão de ${from} (virou vaga)`);
      else if (from !== to) parts.push(`trocou ${from} por ${to}`);
    }
    if (fields.includes('date') || fields.includes('start_time') || fields.includes('end_time')) {
      parts.push(`mudou o horário de ${br(before?.date)} ${before?.start_time}–${before?.end_time} para ${br(after?.date)} ${after?.start_time}–${after?.end_time}`);
    }
    if (fields.includes('sector_id')) parts.push(`mudou o setor para ${ctx.sectorName?.(after?.sector_id) || 'outro setor'}`);
    if (fields.includes('status') && !parts.length) parts.push(`mudou a situação de "${before?.status || '—'}" para "${after?.status || '—'}"`);
    if (!parts.length) parts.push(fields.includes('notes') ? 'atualizou as observações' : `alterou ${fields.join(', ')}`);
    const text = parts.join('; ');
    return `${text.charAt(0).toUpperCase()}${text.slice(1)} — ${shiftLabel(after || before, ctx)}`;
  }

  if (entry?.table_name === 'published_schedules') {
    const row = after || before;
    const sector = ctx.sectorName?.(row?.sector_id) || 'setor';
    const period = `${MONTHS[(Number(row?.month) || 1) - 1]}/${row?.year || ''}`;
    const ranges = Array.isArray(after?.ranges) ? after.ranges : [];
    if (entry.action === 'delete' || ranges.length === 0) return `Voltou a escala de ${sector} (${period}) para rascunho`;
    const last = ranges[ranges.length - 1];
    return `Publicou a escala de ${sector} (${period})${last ? `: ${br(last.start_date)} a ${br(last.end_date)}` : ''}`;
  }

  if (entry?.table_name === 'payment_statuses') {
    const row = after || before;
    const who = ctx.professionalName?.(row?.professional_id) || 'profissional';
    const paid = entry.action !== 'delete' && Boolean(after?.paid);
    return `${paid ? 'Marcou como pago' : 'Desmarcou o pagamento de'} ${who} (${row?.month || ''})`;
  }

  return `${entry?.action || 'alteração'} em ${entry?.table_name || 'registro'}`;
}
