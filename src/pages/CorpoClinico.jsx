import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  UserCheck, 
  ShieldCheck, 
  Calendar, 
  Building2, 
  Plus, 
  Edit3, 
  Loader2, 
  AlertTriangle, 
  Clock, 
  Mail, 
  Phone, 
  FileText,
  Trash2
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'painel', label: 'Painel Geral' },
  { id: 'escalas', label: 'Gestão de Escalas' },
  { id: 'trocas', label: 'Trocas e Repasses' },
  { id: 'corpo-clinico', label: 'Corpo Clínico' },
  { id: 'relatorios', label: 'Relatórios de Horas' },
  { id: 'faturamento', label: 'Faturamento e Repasse' },
  { id: 'configuracoes', label: 'Configurações Globais' }
];

// Grade com todas as escalas e turnos reais da rotina hospitalar
const HOSPITAL_SCHEDULE_PATTERNS = [
  { 
    id: '12x36_D', 
    label: '12x36 Diurno (07:00 às 19:00)', 
    pattern: '12x36', 
    start: '07:00', 
    end: '19:00', 
    type: 'diurno', 
    hours: 12 
  },
  { 
    id: '12x36_N', 
    label: '12x36 Noturno (19:00 às 07:00)', 
    pattern: '12x36', 
    start: '19:00', 
    end: '07:00', 
    type: 'noturno', 
    hours: 12 
  },
  { 
    id: '24x72', 
    label: '24x72 Plantão Integral (07:00 às 07:00)', 
    pattern: '24x72', 
    start: '07:00', 
    end: '07:00', 
    type: '24h', 
    hours: 24 
  },
  { 
    id: '24x48', 
    label: '24x48 Plantão Extensivo (07:00 às 07:00)', 
    pattern: '24x48', 
    start: '07:00', 
    end: '07:00', 
    type: '24h', 
    hours: 24 
  },
  { 
    id: '5x2_COMERCIAL', 
    label: '5x2 Ambulatório / Comercial (08:00 às 17:00)', 
    pattern: '5x2', 
    start: '08:00', 
    end: '17:00', 
    type: 'diurno', 
    hours: 8 
  },
  { 
    id: '5x2_MANHA', 
    label: '5x2 Turno Manhã (07:00 às 13:00)', 
    pattern: '5x2', 
    start: '07:00', 
    end: '13:00', 
    type: 'diurno', 
    hours: 6 
  },
  { 
    id: '5x2_TARDE', 
    label: '5x2 Turno Tarde (13:00 às 19:00)', 
    pattern: '5x2', 
    start: '13:00', 
    end: '19:00', 
    type: 'diurno', 
    hours: 6 
  },
  { 
    id: '6x1_MANHA', 
    label: '6x1 Turno Manhã (07:00 às 13:00)', 
    pattern: '6x1', 
    start: '07:00', 
    end: '13:00', 
    type: 'diurno', 
    hours: 6 
  },
  { 
    id: '6x1_TARDE', 
    label: '6x1 Turno Tarde (13:00 às 19:00)', 
    pattern: '6x1', 
    start: '13:00', 
    end: '19:00', 
    type: 'diurno', 
    hours: 6 
  },
  { 
    id: '6x1_NOITE', 
    label: '6x1 Turno Noite (19:00 às 01:00)', 
    pattern: '6x1', 
    start: '19:00', 
    end: '01:00', 
    type: 'noturno', 
    hours: 6 
  },
  { 
    id: 'CUSTOM', 
    label: 'Horário Personalizado', 
    pattern: 'custom', 
    start: '07:00', 
    end: '19:00', 
    type: 'diurno', 
    hours: 12 
  }
];

export default function CorpoClinico() {
  const { user, company } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('medico');
  const [specialty, setSpecialty] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [permissions, setPermissions] = useState(['painel', 'escalas', 'trocas']);

  // Padrão de Plantão / Escala
  const [selectedPatternPreset, setSelectedPatternPreset] = useState('12x36_D');
  const [schedulePattern, setSchedulePattern] = useState('12x36');
  const [monthReference, setMonthReference] = useState('2026-09');
  const [cycleStartDate, setCycleStartDate] = useState('2026-09-01');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [durationHours, setDurationHours] = useState(12);
  const [defaultSectorId, setDefaultSectorId] = useState('');
  const [autoGenerateShifts, setAutoGenerateShifts] = useState(false);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const units = useMemo(() => {
    return company?.units && company.units.length > 0
      ? company.units
      : [
          { id: 'unit_h1', name: 'Hospital Santa Clara' },
          { id: 'unit_h2', name: 'Hospital Vida & Saúde Dois' }
        ];
  }, [company]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profs, secs] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 300),
        base44.entities.Sector.filter({ company_id: companyId }, 'name', 100)
      ]);
      setProfessionals(profs || []);
      setSectors(secs || []);
    } catch (e) {
      console.error('Erro ao carregar dados do Supabase:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Aplica o padrão pré-configurado selecionado
  const handlePatternPresetChange = (presetId) => {
    setSelectedPatternPreset(presetId);
    const preset = HOSPITAL_SCHEDULE_PATTERNS.find((p) => p.id === presetId);
    if (preset && preset.id !== 'CUSTOM') {
      setSchedulePattern(preset.pattern);
      setStartTime(preset.start);
      setEndTime(preset.end);
      setDurationHours(preset.hours);
    }
  };

  const handleToggleManager = (checked) => {
    setIsManager(checked);
    if (checked) {
      setPermissions(ALL_PERMISSIONS.map((p) => p.id));
    } else {
      setPermissions(['painel', 'escalas', 'trocas']);
    }
  };

  const handlePermissionChange = (permId, checked) => {
    if (checked) {
      setPermissions((prev) => [...prev, permId]);
    } else {
      setPermissions((prev) => prev.filter((p) => p !== permId));
    }
  };

  // Abrir Modal de Novo Cadastro
  const openNewModal = () => {
    setEditingId(null);
    setName('');
    setCategory('medico');
    setSpecialty('');
    setDocument('');
    setEmail('');
    setPhone('');
    setUnitId(units[0]?.id || 'unit_h1');
    setIsManager(false);
    setPermissions(['painel', 'escalas', 'trocas']);
    setSelectedPatternPreset('12x36_D');
    setSchedulePattern('12x36');
    setMonthReference('2026-09');
    setCycleStartDate('2026-09-01');
    setStartTime('07:00');
    setEndTime('19:00');
    setDurationHours(12);
    setDefaultSectorId(sectors[0]?.id || '');
    setAutoGenerateShifts(true);
    setDialogOpen(true);
  };

  // Abrir Modal com os dados existentes do Profissional carregados
  const handleEditProfessional = (prof) => {
    setEditingId(prof.id);
    setName(prof.name || '');
    setCategory(prof.category || 'medico');
    setSpecialty(prof.specialty || '');
    setDocument(prof.document || '');
    setEmail(prof.email || '');
    setPhone(prof.phone || '');
    setUnitId(prof.unit_id || units[0]?.id || 'unit_h1');

    const managerRole = String(prof.role || '').toLowerCase().includes('gestor') || prof.permissions?.includes('configuracoes');
    setIsManager(managerRole);
    setPermissions(Array.isArray(prof.permissions) && prof.permissions.length > 0 
      ? prof.permissions 
      : managerRole ? ALL_PERMISSIONS.map(p => p.id) : ['painel', 'escalas', 'trocas']
    );

    setSchedulePattern(prof.schedule_pattern || '12x36');
    setStartTime(prof.schedule_start_time || '07:00');
    setEndTime(prof.schedule_end_time || '19:00');
    setDefaultSectorId(prof.default_sector_id || sectors[0]?.id || '');
    setAutoGenerateShifts(false); // Na edição vem desligado por padrão para evitar re-gerar sem necessidade

    // Tenta encontrar preset correspondente
    const matchingPreset = HOSPITAL_SCHEDULE_PATTERNS.find(
      (p) => p.pattern === prof.schedule_pattern && p.start === prof.schedule_start_time && p.end === prof.schedule_end_time
    );
    setSelectedPatternPreset(matchingPreset ? matchingPreset.id : 'CUSTOM');

    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profPayload = {
        company_id: companyId,
        unit_id: unitId,
        name,
        category,
        specialty,
        role: isManager ? 'Diretor Médico / Gestor' : specialty || category,
        document,
        email,
        phone,
        status: 'ativo',
        permissions: isManager ? ALL_PERMISSIONS.map((p) => p.id) : permissions,
        schedule_pattern: schedulePattern,
        schedule_start_time: startTime,
        schedule_end_time: endTime,
        default_sector_id: defaultSectorId
      };

      let profRecord;
      if (editingId) {
        profRecord = await base44.entities.Professional.update(editingId, profPayload);
      } else {
        profRecord = await base44.entities.Professional.create(profPayload);
      }

      // Sincroniza usuário e perfil de Gestor no Supabase
      if (email) {
        const existingUsers = await base44.entities.User.filter({ email: email.toLowerCase().trim() });
        const finalPermissions = isManager ? ALL_PERMISSIONS.map((p) => p.id) : permissions;
        const userData = {
          company_id: companyId,
          selected_unit_id: unitId,
          app_role: isManager ? 'manager' : 'professional',
          permissions: finalPermissions
        };

        if (existingUsers.length > 0) {
          await base44.entities.User.update(existingUsers[0].id, {
            full_name: name,
            role: isManager ? 'admin' : 'user',
            data: userData
          });
        } else if (isManager) {
          await base44.entities.User.create({
            email: email.toLowerCase().trim(),
            username: email.split('@')[0],
            password: '123456',
            full_name: name,
            role: 'admin',
            data: userData
          });
        }
      }

      // Geração Automática da Grade do Mês com Trava de Conflito Multi-Unidades
      if (autoGenerateShifts && defaultSectorId && profRecord?.id) {
        const [yearStr, monthStr] = monthReference.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const totalDays = new Date(year, month + 1, 0).getDate();
        const sectorObj = sectors.find((s) => s.id === defaultSectorId);

        // Busca todas as escalas do profissional para impedir choque com outras unidades
        const existingShifts = await base44.entities.Shift.filter({
          company_id: companyId,
          professional_id: profRecord.id
        });

        const shiftsToCreate = [];
        const startDay = new Date(cycleStartDate + 'T00:00:00');

        for (let d = 1; d <= totalDays; d++) {
          const currentDate = new Date(year, month, d);
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          let isWorkDay = false;

          if (schedulePattern === '12x36') {
            const diffDays = Math.round((currentDate - startDay) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % 2 === 0) isWorkDay = true;
          } else if (schedulePattern === '24x72') {
            const diffDays = Math.round((currentDate - startDay) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % 4 === 0) isWorkDay = true;
          } else if (schedulePattern === '24x48') {
            const diffDays = Math.round((currentDate - startDay) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays % 3 === 0) isWorkDay = true;
          } else if (schedulePattern === '5x2') {
            const dow = currentDate.getDay();
            if (dow >= 1 && dow <= 5) isWorkDay = true;
          } else if (schedulePattern === '6x1') {
            const dow = currentDate.getDay();
            if (dow !== 0) isWorkDay = true;
          }

          if (isWorkDay) {
            // Trava de Conflito de Unidades: Checa se já trabalha nesse mesmo dia em outra unidade
            const conflict = existingShifts.find(
              (sh) => sh.date === dateStr && sh.unit_id !== unitId && sh.status !== 'cancelado'
            );

            if (conflict) {
              const conflictUnit = units.find((u) => u.id === conflict.unit_id)?.name || 'outra unidade hospitalar';
              alert(
                `Aviso: No dia ${dateStr}, o profissional ${name} já possui plantão na unidade "${conflictUnit}". O plantão não foi sobreposto.`
              );
              continue;
            }

            shiftsToCreate.push({
              company_id: companyId,
              unit_id: unitId,
              sector_id: defaultSectorId,
              sector_name: sectorObj?.name || 'Geral',
              professional_id: profRecord.id,
              professional_name: name,
              date: dateStr,
              start_time: startTime,
              end_time: endTime,
              shift_type: startTime >= '18:00' ? 'noturno' : 'diurno',
              status: 'confirmado',
              duration_hours: durationHours
            });
          }
        }

        for (const sh of shiftsToCreate) {
          await base44.entities.Shift.create(sh);
        }
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message || 'Erro ao processar alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Corpo Clínico & Escalas</h1>
          <p className="text-sm text-slate-500">
            Gerencie cadastros, libere acessos de gestor, vincule unidades e automatize plantões mensais.
          </p>
        </div>
        <Button onClick={openNewModal} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-medium px-5">
          <Plus className="w-4 h-4" /> Cadastrar profissional
        </Button>
      </div>

      {/* Grid de Profissionais com Botão de Editar Ativo */}
      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : professionals.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-500">Nenhum profissional cadastrado nesta empresa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {professionals.map((prof) => {
            const unitName = units.find((u) => u.id === prof.unit_id)?.name || 'Hospital Santa Clara';
            const isGestor = String(prof.role || '').toLowerCase().includes('gestor');

            return (
              <Card
                key={prof.id}
                className="p-5 border-slate-200 dark:border-slate-800 hover:border-sky-300 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">{prof.name}</h3>
                      <p className="text-xs text-sky-600 font-semibold uppercase tracking-wide">
                        {prof.specialty || prof.category} • {prof.document || 'Sem doc'}
                      </p>
                    </div>
                    {isGestor && (
                      <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full uppercase flex items-center gap-1 shrink-0 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5" /> Gestor
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 pt-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{unitName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Padrão: <b>{prof.schedule_pattern || '12x36'}</b> ({prof.schedule_start_time || '07:00'} - {prof.schedule_end_time || '19:00'})
                      </span>
                    </div>
                    {prof.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{prof.email}</span>
                      </div>
                    )}
                    {prof.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{prof.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão de Edição que carrega todos os dados salvos */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProfessional(prof)}
                    className="text-xs font-semibold gap-1.5 text-slate-700 hover:text-sky-600 hover:border-sky-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Editar Cadastro
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro & Edição Completo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingId ? `Editar Profissional: ${name}` : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-2">
            {/* Dados Pessoais e Profissionais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Nome completo</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Categoria Profissional</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medico">Médico (a)</SelectItem>
                    <SelectItem value="enfermeiro">Enfermeiro (a)</SelectItem>
                    <SelectItem value="tecnico">Técnico (a) de Enfermagem</SelectItem>
                    <SelectItem value="fisioterapeuta">Fisioterapeuta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">Especialidade Clínica</Label>
                <Input required placeholder="Ex: Cardiologia, UTI, Emergência" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Registro / Conselho (CRM / COREN)</Label>
                <Input required value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">E-mail (usado para login)</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* Vínculo de Unidade Hospitalar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" /> Unidade de Lotação
              </Label>
              <p className="text-xs text-slate-500">
                Se o profissional atender em mais de um hospital da rede, crie um vínculo para cada unidade. O sistema valida os plantões para evitar duplicidades no mesmo dia.
              </p>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Controle de Acesso e Perfil de Gestor */}
            <div className="border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> Cadastrar / Ativar como Gestor Pleno
                  </div>
                  <p className="text-xs text-slate-500">
                    Ao ativar, o profissional ganha permissão irrestrita para gerenciar escalas, aprovar trocas e visualizar o hospital por completo.
                  </p>
                </div>
                <Switch checked={isManager} onCheckedChange={handleToggleManager} />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block text-slate-700 dark:text-slate-300">
                  Permissões do Módulo
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border text-xs">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={permissions.includes(perm.id)}
                        disabled={isManager}
                        onCheckedChange={(checked) => handlePermissionChange(perm.id, !!checked)}
                      />
                      <label htmlFor={`perm-${perm.id}`} className="cursor-pointer select-none font-medium">
                        {perm.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Automação Completa de Escalas Hospitalares */}
            <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Escala e Geração Automática do Mês
                  </div>
                  <p className="text-xs text-slate-500">
                    Define a rotina deste profissional e permite gerar todos os plantões do mês de forma automática.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Gerar grade agora:</span>
                  <Switch checked={autoGenerateShifts} onCheckedChange={setAutoGenerateShifts} />
                </div>
              </div>

              {/* Seletor de Escalas Hospitalares */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold">Padrão de Escala Hospitalar</Label>
                  <Select value={selectedPatternPreset} onValueChange={handlePatternPresetChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOSPITAL_SCHEDULE_PATTERNS.map((pattern) => (
                        <SelectItem key={pattern.id} value={pattern.id}>
                          {pattern.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Setor Padrão de Atuação</Label>
                  <Select value={defaultSectorId} onValueChange={setDefaultSectorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                    <SelectContent>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.specialty || 'Geral'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Detalhes de Horários */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl">
                <div>
                  <Label className="text-[11px] text-slate-500">Início do Turno</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Fim do Turno</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Duração (Horas)</Label>
                  <Input type="number" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Ciclo (Regra)</Label>
                  <Input disabled value={schedulePattern.toUpperCase()} className="bg-slate-100 font-bold" />
                </div>
              </div>

              {/* Configuração do Mês para Geração */}
              {autoGenerateShifts && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Mês de Lançamento da Grade
                    </Label>
                    <Input type="month" value={monthReference} onChange={(e) => setMonthReference(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Primeiro Plantão do Ciclo
                    </Label>
                    <Input type="date" value={cycleStartDate} onChange={(e) => setCycleStartDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white px-6">
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
                ) : (
                  editingId ? 'Salvar Alterações' : 'Cadastrar e Concluir'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}