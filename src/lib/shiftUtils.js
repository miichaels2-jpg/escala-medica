/**
 * Converte data e hora (ex: "2026-09-10" e "07:00") em objeto Date local
 */
export function parseShiftDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const cleanDate = dateStr.split('T')[0];
  const [year, month, day] = cleanDate.split('-').map(Number);
  const [hour, minute] = (timeStr || '07:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0);
}

/**
 * Retorna o intervalo exato de início e fim do plantão,
 * tratando corretamente plantões noturnos que viram a noite (ex: 19:00 às 07:00)
 */
export function getShiftInterval(shift) {
  if (!shift || !shift.date) return null;
  const start = parseShiftDateTime(shift.date, shift.start_time || '07:00');
  if (!start) return null;

  let end = parseShiftDateTime(shift.date, shift.end_time || '19:00');
  if (end && end <= start) {
    // Virou a noite para o dia seguinte
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

/**
 * Ciclo de vida do plantão:
 * - 'upcoming': Ainda não começou (Futuro)
 * - 'active': Em andamento neste exato instante
 * - 'recently_finished': Encerrou há menos de 2 horas (passagem de plantão na TV)
 * - 'concluded': Encerrado há mais de 2 horas ou de dias anteriores
 */
export function getShiftTvLifecycle(shift, now = new Date()) {
  const interval = getShiftInterval(shift);
  if (!interval) return { state: 'upcoming', label: 'Programado', detail: 'Horário a definir' };

  const { start, end } = interval;
  const nowMs = now.getTime();
  const startMs = start.getTime();
  const endMs = end.getTime();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  if (nowMs < startMs) {
    return { 
      state: 'upcoming', 
      label: 'Programado', 
      detail: `Inicia às ${shift.start_time || '--:--'}` 
    };
  }

  if (nowMs >= startMs && nowMs <= endMs) {
    return { 
      state: 'active', 
      label: 'Ativo no Plantão', 
      detail: `Término às ${shift.end_time || '--:--'}` 
    };
  }

  if (nowMs > endMs && nowMs <= endMs + twoHoursMs) {
    return { 
      state: 'recently_finished', 
      label: 'Plantão Concluído', 
      detail: `Encerrado às ${shift.end_time || '--:--'}` 
    };
  }

  // Qualquer plantão que encerrou há mais de 2 horas ou de dias anteriores
  return { 
    state: 'concluded', 
    label: 'Plantão Concluído', 
    detail: `Finalizado às ${shift.end_time || '--:--'}` 
  };
}

export function isShiftCurrentlyActive(shift, now = new Date()) {
  return getShiftTvLifecycle(shift, now).state === 'active';
}