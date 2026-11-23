import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CUSTOM_SPECIALTY = '__outra__';

// Lista das especialidades cadastradas, com "Outra (digitar)…" para uma nova.
export default function SpecialtyPicker({ value, options, onChange, triggerClassName = '', contentClassName = '' }) {
  const [typing, setTyping] = useState(false);
  const list = useMemo(() => {
    const set = new Set((options || []).map(o => String(o || '').trim()).filter(Boolean));
    if (String(value || '').trim()) set.add(String(value).trim());
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [options, value]);

  if (typing) {
    return (
      <div className="flex items-center gap-1">
        <Input autoFocus value={value} onChange={e => onChange(e.target.value)} placeholder="Digite a especialidade" className={triggerClassName} />
        <Button type="button" variant="ghost" onClick={() => setTyping(false)} className="h-9 px-2 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0">Lista</Button>
      </div>
    );
  }

  return (
    <Select value={String(value || '').trim() || undefined} onValueChange={v => { if (v === CUSTOM_SPECIALTY) { setTyping(true); onChange(''); } else onChange(v); }}>
      <SelectTrigger className={triggerClassName}><SelectValue placeholder="Escolha a especialidade" /></SelectTrigger>
      <SelectContent className={`z-[99999] ${contentClassName}`}>
        {list.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
        <SelectItem value={CUSTOM_SPECIALTY}>Outra (digitar)…</SelectItem>
      </SelectContent>
    </Select>
  );
}
