import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

const defaultPermissions = ['dashboard', 'escalas', 'trocas', 'relatorios'];

const permissionOptions = [
  { key: 'dashboard', label: 'Painel' },
  { key: 'escalas', label: 'Escalas' },
  { key: 'trocas', label: 'Trocas' },
  { key: 'corpo_clinico', label: 'Corpo clínico' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'configuracoes', label: 'Configurações' }
];

const empty = {
  name: '', document: '', document_uf: '', specialty: '',
  category: 'medico', role: 'Médico', phone: '', email: '', access_email: '', access_password: '', access_password_confirm: '',
  unit_id: '', hourly_rate: '', daily_rate: '',
  shift_preference: 'qualquer', status: 'ativo',
  schedule_pattern: '5x2',
  schedule_start_time: '07:00',
  schedule_end_time: '19:00',
  schedule_reference_date: '',
  schedule_days: ['seg', 'ter', 'qua', 'qui', 'sex'],
  schedule_custom_config: '',
  default_sector_id: '',
  schedule_month: '',
  permissions: [...defaultPermissions]
};

const dayLabels = {
  dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb'
};

const patternConfig = {
  manual: { label: 'Manual', shift_type: 'diurno', durationHours: null },
  '12x36': { label: '12x36', shift_type: 'diurno', durationHours: 12, cycleDays: 2 },
  '24x72': { label: '24x72', shift_type: 'diurno', durationHours: 24, cycleDays: 4 },
  '24x78': { label: '24x78', shift_type: 'diurno', durationHours: 24, cycleDays: 4 },
  '12x60': { label: '12x60', shift_type: 'noturno', durationHours: 12, cycleDays: 3 },
  '7x7': { label: '7x7', shift_type: 'diurno', durationHours: 12, cycleDays: 14 },
  '5x2': { label: '5x2', shift_type: 'diurno', durationHours: 8 },
  custom: { label: 'Personalizado', shift_type: 'diurno', durationHours: null }
};

function addHours(time, hours) {
  if (!time || !Number.isFinite(hours)) return time || '19:00';
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = (hour * 60) + minute + (hours * 60);
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function getMonthKey(date) {
  const current = date ? new Date(date + '-01T00:00:00') : new Date();
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
}

function buildScheduleDates(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return [];

  const [year, month] = monthKey.split('-').map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  const list = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month - 1, day);
    list.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekday: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][date.getDay()]
    });
  }
  return list;
}

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let index = 0; index < 12; index += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

export default function ProfessionalFormDialog({ open, onClose, onSaved, professional, companyId, unitId, sectors = [] }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [companyUnits, setCompanyUnits] = useState([]);
  const isEdit = !!professional;

  const monthOptions = useMemo(() => {
    const now = new Date();
    const options = [];
    for (let i = 0; i < 12; i += 1) {
      const value = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`,
        label: value.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      });
    }
    return options;
  }, []);

  useEffect(() => {
    if (!companyId) return;
    base44.entities.Company.get(companyId)
      .then((company) => setCompanyUnits(company?.units || []))
      .catch(() => setCompanyUnits([]));
  }, [companyId]);

  useEffect(() => {
    if (open) {
      const nextForm = professional ? {
        ...empty,
        ...professional,
        email: professional.email || '',
        access_email: professional.access_email || professional.email || '',
        access_password: '',
        access_password_confirm: '',
        unit_id: professional.unit_id || unitId || '',
        schedule_days: professional.schedule_days || empty.schedule_days,
        schedule_custom_config: professional.schedule_custom_config || '',
        permissions: Array.isArray(professional.permissions) && professional.permissions.length ? professional.permissions : [...defaultPermissions],
        default_sector_id: professional.default_sector_id || '',
        schedule_pattern: professional.schedule_pattern || '5x2',
        schedule_start_time: professional.schedule_start_time || '07:00',
        schedule_end_time: professional.schedule_end_time || '19:00',
        schedule_reference_date: professional.schedule_reference_date || (professional.schedule_month ? `${professional.schedule_month}-01` : ''),
        schedule_month: professional.schedule_month || getMonthKey(new Date().toISOString().slice(0, 10))
      } : {
        ...empty,
        unit_id: unitId || companyUnits[0]?.id || '',
        schedule_month: getMonthKey(new Date().toISOString().slice(0, 10)),
        schedule_reference_date: `${getMonthKey(new Date().toISOString().slice(0, 10))}-01`
      };
      setForm(nextForm);
    }
  }, [open, professional, companyUnits, unitId]);

  useEffect(() => {
    const plan = patternConfig[form.schedule_pattern];
    if (!plan?.durationHours) return;
    setForm((current) => ({ ...current, schedule_end_time: addHours(current.schedule_start_time, plan.durationHours) }));
  }, [form.schedule_pattern, form.schedule_start_time]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleDay = (dayKey) => {
    set('schedule_days', form.schedule_days.includes(dayKey)
      ? form.schedule_days.filter((d) => d !== dayKey)
      : [...form.schedule_days, dayKey]);
  };

  const togglePermission = (permissionKey) => {
    set('permissions', form.permissions.includes(permissionKey)
      ? form.permissions.filter((permission) => permission !== permissionKey)
      : [...form.permissions, permissionKey]);
  };

  const isCyclePattern = ['12x36', '24x72', '24x78', '12x60', '7x7'].includes(form.schedule_pattern);
  const schedulePreview = isCyclePattern
    ? `${patternConfig[form.schedule_pattern]?.label || 'Ciclo'} a partir de ${form.schedule_reference_date || 'data de referência'}`
    : form.schedule_pattern === '5x2'
      ? `${form.schedule_days.map((day) => dayLabels[day]).join(', ') || 'Nenhum dia selecionado'} · ${form.schedule_start_time} às ${form.schedule_end_time}`
      : 'Defina os dias e horários manualmente';

  const generateSchedule = async (professionalId, professionalName, professionalData) => {
    const monthKey = professionalData.schedule_month || getMonthKey(new Date().toISOString().slice(0, 10));
    const selectedDays = [...new Set(professionalData.schedule_days || [])];
    const selectedPattern = professionalData.schedule_pattern || 'manual';
    const plan = patternConfig[selectedPattern] || patternConfig.manual;
    const sectorId = professionalData.default_sector_id;
    const sector = sectors.find((item) => item.id === sectorId);

    if (!sectorId || selectedDays.length === 0) return;

    const monthDates = buildScheduleDates(monthKey);
    const createQueue = [];

    const previousAutomaticShifts = await base44.entities.Shift.filter({
      company_id: companyId,
      professional_id: professionalId,
      unit_id: professionalData.unit_id || unitId
    }, '-created_date', 500);
    await Promise.all(previousAutomaticShifts
      .filter((shift) => getMonthKey(shift.date) === monthKey && String(shift.notes || '').startsWith('Escala gerada automaticamente'))
      .map((shift) => base44.entities.Shift.delete(shift.id)));

    const referenceDate = new Date(`${professionalData.schedule_reference_date || `${monthKey}-01`}T00:00:00`);
    monthDates.forEach(({ date, weekday }) => {
      const dateValue = new Date(`${date}T00:00:00`);
      const cycleMatch = !plan.cycleDays || Math.floor((dateValue - referenceDate) / 86400000) % plan.cycleDays === 0;
      const weekdayMatch = plan.cycleDays ? true : selectedDays.includes(weekday);
      if (!cycleMatch || !weekdayMatch) return;
      if (selectedPattern === '5x2' && !selectedDays.includes(weekday)) return;
      createQueue.push({
        date,
        start_time: professionalData.schedule_start_time || '07:00',
        end_time: professionalData.schedule_end_time || addHours(professionalData.schedule_start_time, plan.durationHours),
        shift_type: plan.shift_type,
        sector_id: sectorId,
        sector_name: sector?.name || '',
        professional_id: professionalId,
        professional_name: professionalName,
        status: 'pendente',
        company_id: companyId,
        unit_id: professionalData.unit_id || unitId,
        notes: `Escala gerada automaticamente (${plan.label})`
      });
    });

    for (const item of createQueue) {
      const existing = await base44.entities.Shift.filter({
        company_id: companyId,
        professional_id: professionalId,
        date: item.date,
        sector_id: sectorId
      }, '-created_date', 20);

      if (existing.length === 0) {
        await base44.entities.Shift.create(item);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const valueFromHourly = form.hourly_rate !== '' && form.hourly_rate !== null && form.hourly_rate !== undefined
        ? Number(form.hourly_rate)
        : null;
      const valueFromDaily = form.daily_rate !== '' && form.daily_rate !== null && form.daily_rate !== undefined
        ? Number(form.daily_rate)
        : valueFromHourly;

      const selectedUnitId = form.unit_id || companyUnits[0]?.id || '';
      const loginEmail = (form.access_email || form.email || '').trim().toLowerCase();
      const loginPassword = (form.access_password || '').trim();
      const confirmPassword = (form.access_password_confirm || '').trim();

      if (!loginEmail) {
        throw new Error('Informe o e-mail de acesso do profissional para login no app.');
      }

      if (loginPassword && loginPassword !== confirmPassword) {
        throw new Error('As senhas de acesso não conferem.');
      }

      const resolvedPassword = loginPassword || generateTemporaryPassword();

      const payload = {
        ...form,
        name: form.name.trim(),
        role: form.role || 'Profissional',
        email: form.email || loginEmail,
        hourly_rate: valueFromHourly,
        daily_rate: valueFromDaily,
        company_id: companyId,
        unit_id: selectedUnitId,
        schedule_days: Array.isArray(form.schedule_days) ? form.schedule_days : [],
        schedule_custom_config: form.schedule_pattern === 'custom' ? (form.schedule_custom_config || '').trim() : '',
        permissions: Array.isArray(form.permissions) && form.permissions.length ? form.permissions : [...defaultPermissions],
        default_sector_id: form.default_sector_id || '',
        schedule_start_time: form.schedule_start_time || '07:00',
        schedule_end_time: form.schedule_end_time || '19:00',
        schedule_reference_date: form.schedule_reference_date || `${form.schedule_month || getMonthKey(new Date().toISOString().slice(0, 10))}-01`,
        schedule_pattern: form.schedule_pattern || 'manual',
        schedule_month: form.schedule_month || getMonthKey(new Date().toISOString().slice(0, 10))
      };

      let savedProfessional;

      if (isEdit) {
        savedProfessional = await base44.entities.Professional.update(professional.id, payload);
      } else {
        savedProfessional = await base44.entities.Professional.create(payload);
      }

      const existingUser = (await base44.entities.User.filter({ email: loginEmail }, '-created_date', 20))[0];
      const username = loginEmail.split('@')[0] || `prof-${savedProfessional.id}`;
      const userData = {
        company_id: companyId,
        selected_unit_id: selectedUnitId,
        app_role: 'professional',
        professional_id: savedProfessional.id,
        professional_role: payload.role || 'Profissional',
        permissions: payload.permissions || [...defaultPermissions],
        unit_id: selectedUnitId
      };

      if (!existingUser) {
        const createdUser = await base44.entities.User.create({
          username,
          email: loginEmail,
          password: resolvedPassword,
          full_name: payload.name,
          role: 'user',
          data: userData
        });

        await base44.entities.Professional.update(savedProfessional.id, {
          user_id: createdUser.id,
          email: loginEmail,
          unit_id: selectedUnitId,
          role: payload.role || 'Profissional',
          permissions: payload.permissions || [...defaultPermissions]
        });

        alert(`Credenciais criadas para ${payload.name}\nE-mail: ${loginEmail}\nSenha: ${resolvedPassword}`);
      } else {
        await base44.entities.User.update(existingUser.id, {
          username: existingUser.username || username,
          email: loginEmail,
          password: resolvedPassword,
          full_name: payload.name,
          role: 'user',
          data: {
            ...(existingUser.data || {}),
            ...userData
          }
        });

        await base44.entities.Professional.update(savedProfessional.id, {
          user_id: existingUser.id,
          email: loginEmail,
          unit_id: selectedUnitId,
          role: payload.role || 'Profissional',
          permissions: payload.permissions || [...defaultPermissions]
        });

        alert(`Credenciais atualizadas para ${payload.name}\nE-mail: ${loginEmail}\nSenha: ${resolvedPassword}`);
      }

      if (payload.schedule_pattern !== 'manual' && (payload.schedule_days?.length || ['12x36', '24x72', '24x78', '12x60', '7x7'].includes(payload.schedule_pattern)) && payload.default_sector_id) {
        await generateSchedule(savedProfessional.id, payload.name, payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      alert(err.message || 'Erro ao salvar profissional');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>CBO</Label>
              <Input value={form.document} onChange={(e) => set('document', e.target.value)} placeholder="2231-05" />
            </div>
            <div className="space-y-1.5">
              <Label>UF / Registro</Label>
              <Input value={form.document_uf} onChange={(e) => set('document_uf', e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Médico</SelectItem>
                  <SelectItem value="enfermeiro">Enfermeiro</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="auxiliar">Auxiliar</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Especialidade / Setor</Label>
              <Input value={form.specialty} onChange={(e) => set('specialty', e.target.value)} placeholder="Cardiologia, UTI, Clínica Médica" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Função / Cargo</Label>
            <Input value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="Diretor Médico, Enfermeiro, Coordenador, Residente..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail de contato</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Credenciais de acesso do app</p>
              <p className="text-[11px] text-slate-500">O gestor pode entregar esse e-mail e senha para o profissional entrar na unidade correta.</p>
            </div>

            <div className="space-y-1.5">
              <Label>E-mail para login</Label>
              <Input
                type="email"
                value={form.access_email}
                onChange={(e) => set('access_email', e.target.value)}
                placeholder="profissional@hospital.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Senha temporária</Label>
                <Input
                  type="text"
                  value={form.access_password}
                  onChange={(e) => set('access_password', e.target.value)}
                  placeholder="Opcional: informe ou gere"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirmar senha</Label>
                <Input
                  type="text"
                  value={form.access_password_confirm}
                  onChange={(e) => set('access_password_confirm', e.target.value)}
                  placeholder="Repetir senha"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Unidade de acesso</Label>
              <Select value={form.unit_id} onValueChange={(v) => set('unit_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {companyUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor hora (R$)</Label>
              <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => set('hourly_rate', e.target.value)} placeholder="80.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor por plantão (R$)</Label>
              <Input type="number" step="0.01" value={form.daily_rate} onChange={(e) => set('daily_rate', e.target.value)} placeholder="700.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preferência</Label>
            <Select value={form.shift_preference} onValueChange={(v) => set('shift_preference', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qualquer">Qualquer turno</SelectItem>
                <SelectItem value="diurno">Diurno</SelectItem>
                <SelectItem value="noturno">Noturno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="ferias">Férias</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Escala mensal automática</p>
                <p className="text-[11px] text-slate-500">Gere o plantão do mês com padrão hospitalar e dias selecionados.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Padrão</Label>
                <Select value={form.schedule_pattern} onValueChange={(v) => {
                  set('schedule_pattern', v);
                  if (v === '5x2') set('schedule_days', ['seg', 'ter', 'qua', 'qui', 'sex']);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual / livre</SelectItem>
                    <SelectItem value="12x36">12x36</SelectItem>
                    <SelectItem value="24x72">24x72</SelectItem>
                    <SelectItem value="24x78">24x78</SelectItem>
                    <SelectItem value="12x60">12x60</SelectItem>
                    <SelectItem value="7x7">7x7</SelectItem>
                    <SelectItem value="5x2">5x2</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Select value={form.schedule_month} onValueChange={(v) => set('schedule_month', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.schedule_pattern === 'custom' && (
              <div className="space-y-1.5">
                <Label>Descrição do padrão personalizado</Label>
                <textarea
                  value={form.schedule_custom_config}
                  onChange={(e) => set('schedule_custom_config', e.target.value)}
                  placeholder="Ex.: 2 noites seg/qua, 1 dia de folga a cada 4 dias, turno 07:00 às 19:00, plantão 24h para enfermeiros OB..."
                  className="min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </div>
            )}

            {form.schedule_pattern !== 'manual' && form.schedule_pattern !== 'custom' && (
              <div className="space-y-1.5">
                <Label>Primeiro dia do ciclo</Label>
                <Input type="date" value={form.schedule_reference_date} onChange={(e) => set('schedule_reference_date', e.target.value)} />
                <p className="text-[11px] text-slate-500">A partir desta data o sistema recalcula automaticamente os dias trabalhados na duplicação mensal.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início do turno</Label>
                <Input type="time" value={form.schedule_start_time} onChange={(e) => set('schedule_start_time', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim do turno</Label>
                <Input type="time" value={form.schedule_end_time} onChange={(e) => set('schedule_end_time', e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Setor padrão</Label>
              <Select value={form.default_sector_id} onValueChange={(v) => set('default_sector_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor da escala" /></SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>{sector.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dias da semana</Label>
              <p className="text-[11px] text-slate-500">{isCyclePattern ? 'O ciclo usa a data de referência. Não é necessário marcar os dias.' : 'O 5x2 começa automaticamente de segunda a sexta. Ajuste apenas se necessário.'}</p>
              <div className={`grid grid-cols-7 gap-2 ${isCyclePattern ? 'pointer-events-none opacity-45' : ''}`}>
                {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].map((day) => (
                  <label key={day} className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center text-[10px] font-medium transition ${form.schedule_days.includes(day) ? 'border-sky-400 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <Checkbox
                      checked={form.schedule_days.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    {dayLabels[day]}
                  </label>
                ))}
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">Prévia: {schedulePreview}</div>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Permissões do acesso</p>
              <p className="text-[11px] text-slate-500">Controle o que este profissional pode visualizar e alterar dentro do sistema.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {permissionOptions.map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700">
                  <Checkbox
                    checked={form.permissions.includes(permission.key)}
                    onCheckedChange={() => togglePermission(permission.key)}
                  />
                  {permission.label}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}