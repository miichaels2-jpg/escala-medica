// Boas-vindas do plantonista (topo da Minha Escala) e aniversários da equipe (Painel).
// Tudo em frases curtas, no lugar de números soltos.

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function greetingFor(now = new Date()) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(name) {
  const first = String(name || '').trim().split(/\s+/)[0] || '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

// "07:00" → "7h", "19:30" → "19h30"
export function hourLabel(time) {
  const [h, m] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

// "hoje", "amanhã", "na sexta" (até 6 dias) ou "em 12/12"
export function relativeDay(date, now = new Date()) {
  const [y, m, d] = String(date || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const target = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target - today) / 86400000);
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  if (days > 1 && days <= 6) return `${target.getDay() === 0 || target.getDay() === 6 ? 'no' : 'na'} ${WEEKDAYS[target.getDay()]}`;
  return `em ${pad(d)}/${pad(m)}`;
}

// Aceita "AAAA-MM-DD" e "DD/MM/AAAA"; devolve { month, day } ou null.
export function parseBirthDate(value) {
  const text = String(value || '').trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return { month: Number(match[2]), day: Number(match[3]) };
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return { month: Number(match[2]), day: Number(match[1]) };
  return null;
}

export function birthDateOf(professional) {
  return professional?.data?.birth_date || professional?.birth_date || '';
}

export function isBirthday(value, now = new Date()) {
  const birth = parseBirthDate(value);
  return Boolean(birth && birth.month === now.getMonth() + 1 && birth.day === now.getDate());
}

/**
 * Título e frases de boas-vindas.
 * @param {object} o
 * @param {string} o.name nome do profissional
 * @param {object} [o.activeShift] plantão em andamento { end_time, sectorName }
 * @param {object} [o.nextShift] próximo plantão { date, start_time, sectorName, unitName }
 * @param {string} [o.monthName] "novembro"
 * @param {number} [o.done] plantões feitos no mês
 * @param {number} [o.total] plantões do mês
 * @param {number|null} [o.amount] valor a receber até agora (null = não mostrar)
 * @param {boolean} [o.paid] pagamento do mês já confirmado
 * @param {boolean} [o.birthday]
 */
export function buildWelcome({ name, now = new Date(), activeShift, nextShift, monthName, done = 0, total = 0, amount = null, paid = false, birthday = false }) {
  const first = firstName(name);
  const title = birthday
    ? `Feliz aniversário${first ? `, ${first}` : ''}!`
    : `${greetingFor(now)}${first ? `, ${first}` : ''}!`;
  const lines = [];
  if (birthday) lines.push('Que o seu dia seja leve. Obrigado por fazer parte da equipe.');

  if (activeShift) {
    lines.push(`Você está de plantão agora${activeShift.sectorName ? ` no setor ${activeShift.sectorName}` : ''}, até ${hourLabel(activeShift.end_time)}.`);
  } else if (nextShift) {
    const where = nextShift.sectorName ? `, no setor ${nextShift.sectorName}${nextShift.unitName ? ` (${nextShift.unitName})` : ''}` : '';
    lines.push(`Seu próximo plantão é ${relativeDay(nextShift.date, now)}, às ${hourLabel(nextShift.start_time)}${where}.`);
  } else {
    lines.push('Você não tem plantão marcado. Veja as vagas abertas no Mural.');
  }

  if (total > 0 && monthName) {
    const count = `${done} de ${total} ${total === 1 ? 'plantão feito' : 'plantões feitos'}`;
    if (paid) lines.push(`Em ${monthName}: ${count}, pagamento confirmado.`);
    else lines.push(amount > 0 ? `Em ${monthName}: ${count} e ${brl(amount)} a receber até agora.` : `Em ${monthName}: ${count}.`);
  }
  return { title, lines };
}

// Aniversários de hoje até `days` dias à frente, do mais próximo ao mais distante.
export function upcomingBirthdays(professionals = [], now = new Date(), days = 7) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list = [];
  professionals.forEach(prof => {
    if (!prof || String(prof.status || 'ativo') !== 'ativo') return;
    const birth = parseBirthDate(birthDateOf(prof));
    if (!birth) return;
    for (let offset = 0; offset <= days; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      if (date.getMonth() + 1 === birth.month && date.getDate() === birth.day) {
        list.push({ id: prof.id, name: prof.name, date: dayKey(date), when: offset === 0 ? 'hoje' : relativeDay(dayKey(date), now).replace(/^em /, '') });
        break;
      }
    }
  });
  return list.sort((a, b) => a.date.localeCompare(b.date) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
}
