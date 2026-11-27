import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Building2, Search, User, LayoutGrid } from 'lucide-react';
import { useAppData, setUnitScope } from '@/lib/useAppData';
import { formatDateBR, getLocalDateString, normalize } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Busca rápida (V0.10.3): Ctrl+K (ou a lupa do topo) acha telas, profissionais, setores e plantões
// de uma data ("12/12" ou "hoje"). Abre direto onde a pessoa precisa.
const MAX = 6;

function parseDateQuery(q) {
  const text = normalize(q);
  const today = new Date();
  if (text === 'hoje') return getLocalDateString(today);
  if (text === 'amanha') { today.setDate(today.getDate() + 1); return getLocalDateString(today); }
  const m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : today.getFullYear();
  return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

export default function QuickSearch({ navItems = [], open, onOpenChange }) {
  const navigate = useNavigate();
  const { isManager, isBilling, allCompanyProfessionals = [], allCompanySectors = [], allCompanyShifts = [], units = [], currentProfessional, user } = useAppData();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const allowedUnits = useMemo(() => {
    const allowed = Array.isArray(user?.data?.allowed_unit_ids) ? user.data.allowed_unit_ids.map(String) : [];
    return new Set(units.filter(u => user?.role === 'admin' || !allowed.length || allowed.includes(String(u.id))).map(u => String(u.id)));
  }, [units, user]);
  const unitName = id => units.find(u => String(u.id) === String(id))?.name || '';
  const sectorName = id => allCompanySectors.find(s => String(s.id) === String(id))?.name || 'Setor';
  const profName = id => allCompanyProfessionals.find(p => String(p.id) === String(id))?.name || '';

  const openShift = shift => {
    if (shift.unit_id && allowedUnits.has(String(shift.unit_id))) setUnitScope(String(shift.unit_id));
    try { window.localStorage.setItem('scale_auto_open_shift_id', String(shift.id)); } catch { /* sem armazenamento */ }
    navigate(isManager ? '/escalas' : '/minha-escala');
  };

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return navItems.slice(0, MAX).map(item => ({ key: item.path, group: 'Telas', icon: item.icon || LayoutGrid, label: item.label, run: () => navigate(item.path) }));
    const out = [];
    navItems.filter(item => normalize(item.label).includes(q)).slice(0, 4)
      .forEach(item => out.push({ key: item.path, group: 'Telas', icon: item.icon || LayoutGrid, label: item.label, run: () => navigate(item.path) }));
    const date = parseDateQuery(query.trim());
    if (date) {
      allCompanyShifts.filter(s => String(s.date).slice(0, 10) === date && allowedUnits.has(String(s.unit_id)) && s.status !== 'cancelado' &&
        (isManager || String(s.professional_id) === String(currentProfessional?.id)))
        .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))).slice(0, 8)
        .forEach(s => out.push({ key: `s${s.id}`, group: `Plantões de ${formatDateBR(date)}`, icon: CalendarDays, label: `${s.start_time}–${s.end_time} · ${sectorName(s.sector_id)}`, hint: `${s.professional_id ? profName(s.professional_id) || s.professional_name || '' : 'Vaga aberta'}${units.length > 1 ? ` · ${unitName(s.unit_id)}` : ''}`, run: () => openShift(s) }));
    }
    if (isManager || isBilling) {
      const digits = q.replace(/\D/g, '');
      allCompanyProfessionals.filter(p => normalize(p.name).includes(q) || normalize(p.specialty).includes(q) || (digits.length >= 4 && String(p.cpf || '').replace(/\D/g, '').includes(digits)))
        .slice(0, MAX).forEach(p => {
          const next = allCompanyShifts.filter(s => String(s.professional_id) === String(p.id) && String(s.date).slice(0, 10) >= getLocalDateString() && s.status !== 'cancelado')
            .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.start_time).localeCompare(String(b.start_time)))[0];
          out.push({ key: `p${p.id}`, group: 'Profissionais', icon: User, label: p.name, hint: [p.specialty, next ? `próximo plantão ${formatDateBR(next.date).slice(0, 5)} ${next.start_time} · ${sectorName(next.sector_id)}` : 'sem plantão marcado'].filter(Boolean).join(' · '), run: () => navigate(`/corpo-clinico?busca=${encodeURIComponent(p.name)}`) });
          if (next && isManager) out.push({ key: `n${next.id}`, group: 'Profissionais', icon: CalendarDays, label: `↳ Abrir o próximo plantão de ${p.name.split(' ')[0]}`, hint: `${formatDateBR(next.date)} ${next.start_time}–${next.end_time}`, run: () => openShift(next) });
        });
    }
    if (isManager) {
      allCompanySectors.filter(s => s.active !== false && allowedUnits.has(String(s.unit_id)) && normalize(s.name).includes(q)).slice(0, 4)
        .forEach(s => out.push({ key: `t${s.id}`, group: 'Setores', icon: Building2, label: s.name, hint: units.length > 1 ? unitName(s.unit_id) : 'abrir na Escala', run: () => {
          setUnitScope(String(s.unit_id));
          try { window.localStorage.setItem('scale_filter_sector_id', String(s.id)); } catch { /* sem armazenamento */ }
          navigate('/escalas');
        } }));
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, navItems, allCompanyProfessionals, allCompanySectors, allCompanyShifts, isManager, isBilling, allowedUnits, currentProfessional]);

  useEffect(() => { setActive(0); }, [query]);

  const choose = item => { onOpenChange(false); item.run(); };
  const onKeyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(results.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
  };

  let lastGroup = '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader className="sr-only"><DialogTitle>Busca rápida</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pl-3 pr-10">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder={isManager || isBilling ? 'Profissional, setor, tela ou data (12/12, hoje)…' : 'Tela ou data do plantão (12/12, hoje)…'}
            className="h-12 flex-1 bg-transparent text-sm outline-none text-slate-900 dark:text-white placeholder:text-slate-400" aria-label="Buscar" />
        </div>
        <ul className="max-h-[60vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nada encontrado para “{query}”.</li>}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                {header && <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{header}</p>}
                <button type="button" role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer ${index === active ? 'bg-sky-50 dark:bg-sky-500/10' : ''}`}>
                  <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-900 dark:text-white">{item.label}</span>
                    {item.hint && <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{item.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-slate-200 dark:border-slate-800 px-4 py-2 text-[11px] text-slate-400">↑ ↓ para escolher · Enter para abrir · Ctrl+K de qualquer tela</p>
      </DialogContent>
    </Dialog>
  );
}
