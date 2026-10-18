// Montar o mês seguinte a partir de um mês de referência.

function pad(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

// Data correspondente no mês de destino.
// 'semana': mesmo dia da semana na mesma semana do mês (a 2ª segunda continua 2ª segunda);
//           se o destino não tiver essa ocorrência (5ª semana), o plantão não é copiado.
// 'dia':    mesmo número de dia (31 não existe em meses de 30 dias e é ignorado).
export function mapDateToMonth(sourceDate, targetYear, targetMonth, mode = 'semana') {
  const [y, m, d] = String(sourceDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  if (mode === 'dia') {
    return d <= daysInMonth(targetYear, targetMonth) ? `${targetYear}-${pad(targetMonth)}-${pad(d)}` : null;
  }
  const weekday = new Date(y, m - 1, d).getDay();
  const occurrence = Math.ceil(d / 7); // 1ª, 2ª, 3ª... ocorrência desse dia da semana no mês
  const firstWeekday = new Date(targetYear, targetMonth - 1, 1).getDay();
  const firstDay = 1 + ((weekday - firstWeekday + 7) % 7);
  const day = firstDay + (occurrence - 1) * 7;
  return day <= daysInMonth(targetYear, targetMonth) ? `${targetYear}-${pad(targetMonth)}-${pad(day)}` : null;
}

export function nextMonthOf(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
