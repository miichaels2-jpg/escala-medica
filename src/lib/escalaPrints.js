// Impressos da tela Escala (plantão do dia e escala do mês), no padrão de printLayout.
import { MONTH_NAMES, WEEKDAYS, escapeHtml, extractSpecialty, formatDateBR, getLocalDateString, getShiftName, isShiftPast, isVacant, sentenceCase } from '@/lib/escalaUtils';
import { buildPrintDocument, openPrintWindow, printHeader, printLogos, printWatermark, shortPersonName } from '@/lib/printLayout';

export function printDayShifts({ company, getPublishedRanges, liveNow, professionalMap, sectorMap, selectedUnitId, tvData, units, user }) {
  const currentUnitObj = units?.find(u => String(u.id) === String(selectedUnitId));
  const unitName = currentUnitObj?.name || company?.name || '';
  const dayLabel = sentenceCase(liveNow.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
  const isDatePublished = shift => getPublishedRanges(selectedUnitId, shift.sector_id, ...String(shift.date).split('-').slice(0, 2).map(Number))
    .some(r => shift.date >= r.start_date && shift.date <= r.end_date);

  const dayShifts = tvData.tableDayShifts.slice().sort((a, b) =>
    String(sectorMap[String(a.sector_id)]?.name || '').localeCompare(String(sectorMap[String(b.sector_id)]?.name || '')) ||
    String(a.start_time).localeCompare(String(b.start_time)));
  const draftCount = dayShifts.filter(s => !isDatePublished(s)).length;

  let lastSector = null;
  const rows = dayShifts.map(shift => {
    const prof = professionalMap[String(shift.professional_id)];
    const sectorName = sectorMap[String(shift.sector_id)]?.name || 'Setor';
    const firstOfSector = sectorName !== lastSector;
    lastSector = sectorName;
    const who = isVacant(shift)
      ? `<span class="vaga">${isShiftPast(shift, liveNow) ? 'FURO' : 'VAGA'}</span>`
      : `<b>${escapeHtml(prof?.name || getShiftName(shift) || 'Profissional')}</b>`;
    return `<tr class="${firstOfSector ? 'first' : ''}">
      <td class="sector">${firstOfSector ? `${escapeHtml(sectorName)}${isDatePublished(shift) ? '' : ' <span class="pl-muted">(rascunho)</span>'}` : ''}</td>
      <td class="pl-num">${escapeHtml(shift.start_time)}–${escapeHtml(shift.end_time)}</td>
      <td>${who}</td>
      <td>${escapeHtml(extractSpecialty(shift, prof))}</td>
      <td>${escapeHtml(isVacant(shift) ? '' : (prof?.document || ''))}</td>
    </tr>`;
  }).join('');

  const body = `<section class="pl-sheet">
    ${dayShifts.length && draftCount === dayShifts.length ? printWatermark({ text: 'RASCUNHO' }) : ''}
    ${printHeader({
      logos: printLogos({ company, unit: currentUnitObj }),
      orgName: unitName,
      title: 'Plantão do dia',
      subtitle: dayLabel,
      meta: [['Plantões', String(dayShifts.length)], ['Vagas', String(dayShifts.filter(isVacant).length)]]
    })}
    <table class="pl-table day">
      <thead><tr><th style="width:22%">Setor</th><th style="width:12%">Horário</th><th style="width:30%">Profissional</th><th style="width:20%">Especialidade</th><th style="width:16%">Registro</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="pl-muted" style="text-align:center;padding:18px">Nenhum plantão nesta data.</td></tr>'}</tbody>
    </table>
    <div class="pl-signatures"><div>Diretoria clínica / RT médica</div><div>Gerência de enfermagem / RT assistencial</div></div>
  </section>`;

  const html = buildPrintDocument({
    docTitle: `Plantão do dia · ${unitName} · ${formatDateBR(getLocalDateString(liveNow))}`,
    orientation: 'landscape',
    issuedBy: user?.full_name || '',
    css: `
      .day { table-layout: fixed; font-size: 10px; }
      .day tr.first td { border-top: 1px solid #94a3b8; }
      .day td.sector { font-weight: 600; }
      .vaga { display: inline-block; padding: 0 6px; border: 1px solid #b45309; border-radius: 3px; color: #b45309; font-weight: 700; font-size: 8px; letter-spacing: .04em; }
    `,
    body
  });
  if (!openPrintWindow(html)) alert('Permita pop-ups para abrir a impressão.');
}

export function printMonthSchedule({ company, currentMonth, currentYear, daysInMonth, getSectorPublishedRanges, liveNow, professionalMap, scheduleVisibleShifts, sectorMap, sectors, selectedUnitId, units, user }) {
  const unit = units?.find(item => String(item.id) === String(selectedUnitId));
  const monthLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  const logos = printLogos({ company, unit });
  const hh = time => String(time || '').replace(/:00$/, '');

  const bySector = new Map();
  scheduleVisibleShifts.forEach(shift => {
    const key = String(shift.sector_id);
    if (!bySector.has(key)) bySector.set(key, []);
    bySector.get(key).push(shift);
  });
  const orderedSectors = [
    ...(sectors || []).filter(sec => bySector.has(String(sec.id))),
    ...[...bySector.keys()].filter(id => !sectorMap[id]).map(id => ({ id, name: 'Setor' }))
  ];

  const sections = orderedSectors.map((sector, index) => {
    const list = bySector.get(String(sector.id)) || [];
    const turns = [...new Map(list.map(s => [`${s.start_time}|${s.end_time}`, { start: s.start_time, end: s.end_time }])).values()]
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const published = getSectorPublishedRanges(sector.id).length > 0;
    const vacancies = list.filter(isVacant).length;

    const rows = daysInMonth.map(dateObj => {
      const dateStr = getLocalDateString(dateObj);
      const weekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const cells = turns.map(turn => {
        const names = list
          .filter(s => s.date === dateStr && s.start_time === turn.start && s.end_time === turn.end)
          .map(s => isVacant(s)
            ? `<span class="vaga">${isShiftPast(s, liveNow) ? 'FURO' : 'VAGA'}</span>`
            : escapeHtml(shortPersonName(professionalMap[String(s.professional_id)]?.name || getShiftName(s) || 'Profissional')));
        return `<td>${names.join(' · ')}</td>`;
      }).join('');
      return `<tr class="${weekend ? 'weekend' : ''}"><td class="day"><b>${String(dateObj.getDate()).padStart(2, '0')}</b> ${WEEKDAYS[dateObj.getDay()].short}</td>${cells}</tr>`;
    }).join('');

    return `<section class="pl-sheet sector${index ? ' next' : ''}">
      ${published ? '' : printWatermark({ text: 'RASCUNHO' })}
      ${printHeader({
        logos,
        orgName: unit?.name || company?.name || '',
        title: `Escala · ${sector.name}`,
        subtitle: monthLabel,
        meta: [['Plantões', String(list.length)], ['Vagas', String(vacancies)], ['Situação', published ? 'Publicada' : 'Rascunho']]
      })}
      <table class="pl-table grid">
        <thead><tr><th class="day">Dia</th>${turns.map(t => `<th>${escapeHtml(hh(t.start))}–${escapeHtml(hh(t.end))} <span>${String(t.start) >= '18:00' || String(t.start) < '06:00' ? 'noite' : 'dia'}</span></th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="pl-note">VAGA = turno ainda sem profissional · FURO = turno passado que ficou sem ninguém.</p>
    </section>`;
  }).join('');

  const body = sections || printHeader({ logos, orgName: unit?.name || company?.name || '', title: 'Escala do mês', subtitle: monthLabel }) +
    '<p class="pl-note">Nenhum plantão corresponde aos filtros atuais.</p>';

  const html = buildPrintDocument({
    docTitle: `Escala · ${monthLabel}`,
    orientation: 'landscape',
    issuedBy: user?.full_name || '',
    margin: '9mm 10mm 13mm',
    css: `
      .sector.next { break-before: page; page-break-before: always; }
      .sector .pl-header { margin-bottom: 8px; padding-bottom: 7px; }
      .sector .pl-logo { height: 32px; }
      .grid { table-layout: fixed; font-size: 8.5px; }
      .grid th { text-align: center; }
      .grid th span { font-weight: 500; color: #64748b; text-transform: none; letter-spacing: 0; }
      .grid td { padding: 2.6px 6px; text-align: center; border: 1px solid #e2e8f0; line-height: 1.3; }
      .grid .day { width: 52px; text-align: left; white-space: nowrap; color: #475569; }
      .grid .day b { color: #0f172a; font-variant-numeric: tabular-nums; }
      .grid tr.weekend td { background: #f8fafc; }
      .vaga { display: inline-block; padding: 0 5px; border: 1px solid #b45309; border-radius: 3px; color: #b45309; font-weight: 700; font-size: 7.5px; letter-spacing: .04em; }
      .pl-note { margin-top: 5px; }
    `,
    body
  });
  if (!openPrintWindow(html, 'width=1200,height=850')) alert('Permita pop-ups para abrir a impressão da escala mensal.');
}
