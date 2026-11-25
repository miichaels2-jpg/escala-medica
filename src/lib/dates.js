// Datas do sistema (strings "AAAA-MM-DD" do banco), sempre no dia local do Brasil.

// "AAAA-MM-DD" como data local. new Date("2026-11-25") é meia-noite UTC, ou seja, 24/11 às 21h
// no Brasil: a credencial aparecia vencida no seu último dia válido.
export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Vencida só a partir do dia seguinte ao da validade.
export function isCredentialExpired(value, today = new Date()) {
  const date = parseLocalDate(value);
  if (!date) return false;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return date < start;
}
