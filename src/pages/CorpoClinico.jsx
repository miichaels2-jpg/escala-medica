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
import { UserCheck, ShieldCheck, Calendar, Building2, Plus, Edit2, Loader2, AlertCircle } from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'painel', label: 'Painel' },
  { id: 'escalas', label: 'Escalas' },
  { id: 'trocas', label: 'Trocas' },
  { id: 'corpo-clinico', label: 'Corpo Clínico' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'configuracoes', label: 'Configurações' }
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
  
  // Regra de Escala Automática
  const [schedulePattern, setSchedulePattern] = useState('12x36');
  const [monthReference, setMonthReference] = useState('2026-09');
  const [cycleStartDate, setCycleStartDate] = useState('2026-09-01');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [defaultSectorId, setDefaultSectorId] = useState('');
  const [autoGenerateShifts, setAutoGenerateShifts] = useState(true);

  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const units = company?.units || [
    { id: 'unit_h1', name: 'Hospital Santa Clara' },
    { id: 'unit_h2', name: 'Hospital Vida & Saúde Dois' }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [profs, secs] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 300),
        base44.entities.Sector.filter({ company_id: companyId }, 'name', 100)
      ]);
      setProfessionals(profs);
      setSectors(secs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

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
    setSchedulePattern('12x36');
    setMonthReference('2026-09');
    setCycleStartDate('2026-09-01');
    setStartTime('07:00');
    setEndTime('19:00');
    setDefaultSectorId(sectors[0]?.id || '');
    setAutoGenerateShifts(true);
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
        permissions,
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

      // Se for Gestor, cria ou atualiza conta de usuário com app_role = manager
      if (isManager && email) {
        const existingUsers = await base44.entities.User.filter({ email: email.toLowerCase() });
        const userData = {
          company_id: companyId,
          selected_unit_id: unitId,
          app_role: 'manager',
          permissions
        };
        if (existingUsers.length > 0) {
          await base44.entities.User.update(existingUsers[0].id, {
            role: 'admin',
            data: userData
          });
        } else {
          await base44.entities.User.create({
            email: email.toLowerCase(),
            username: email.split('@')[0],
            password: '123456',
            full_name: name,
            role: 'admin',
            data: userData
          });
        }
      }

      // Geração Automática da Escala do Mês com Verificação de Conflito Multi-Unidade
      if (autoGenerateShifts && defaultSectorId && profRecord?.id) {
        const [yearStr, monthStr] = monthReference.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const totalDays = new Date(year, month + 1, 0).getDate();
        const sectorObj = sectors.find((s) => s.id === defaultSectorId);

        // Busca todos os plantões do profissional na empresa para checar choque de agenda
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
            if (diffDays >= 0 && diffDays % 2 === 0) {
              isWorkDay = true;
            }
          } else if (schedulePattern === '5x2') {
            const dow = currentDate.getDay();
            if (dow >= 1 && dow <= 5) isWorkDay = true;
          } else if (schedulePattern === '6x1') {
            const dow = currentDate.getDay();
            if (dow !== 0) isWorkDay = true;
          }

          if (isWorkDay) {
            // Trava de Conflito de Unidades
            const conflict = existingShifts.find((sh) => sh.date === dateStr && sh.unit_id !== unitId && sh.status !== 'cancelado');
            if (conflict) {
              const conflictUnit = units.find((u) => u.id === conflict.unit_id)?.name || 'outra unidade';
              alert(`Atenção: O profissional ${name} já possui plantão no dia ${dateStr} na unidade "${conflictUnit}". O plantão deste dia não foi duplicado.`);
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
              duration_hours: 12
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
      alert(err.message || 'Erro ao salvar profissional.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Corpo Clínico & Escalas</h1>
          <p className="text-sm text-slate-500">Gestão de profissionais, vínculos por unidade e geração de escalas mensais</p>
        </div>
        <Button onClick={openNewModal} className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
          <Plus className="w-4 h-4" /> Cadastrar profissional
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-sky-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((prof) => {
            const unitName = units.find((u) => u.id === prof.unit_id)?.name || 'Unidade Geral';
            return (
              <Card key={prof.id} className="p-5 border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{prof.name}</h3>
                    <p className="text-xs text-sky-600 font-medium">{prof.specialty || prof.category} • {prof.document}</p>
                  </div>
                  {prof.role?.includes('Gestor') && (
                    <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Gestor
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /> {unitName}</div>
                  <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Padrão: {prof.schedule_pattern || '12x36'}</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Profissional' : 'Novo Cadastro de Profissional'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Nome completo</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medico">Médico</SelectItem>
                    <SelectItem value="enfermeiro">Enfermeiro</SelectItem>
                    <SelectItem value="tecnico">Técnico de Enfermagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Especialidade</Label>
                <Input required placeholder="Ex: Cardiologia, UTI, Emergência" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </div>
              <div>
                <Label>Documento / Registro (CRM / COREN)</Label>
                <Input required value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <div>
                <Label>E-mail (para login e notificações)</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Telefone / WhatsApp</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* Unidade de Atuação */}
            <div className="border-t pt-3">
              <Label className="font-semibold text-slate-800 dark:text-slate-200">Unidade Hospitalar de Atuação</Label>
              <p className="text-xs text-slate-500 mb-2">Para alocar em múltiplas unidades, faça um cadastro para cada unidade. O sistema bloqueia automaticamente choque de horários entre elas.</p>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Configuração de Acesso / Gestor */}
            <div className="border border-sky-100 dark:border-sky-950 bg-sky-50/50 dark:bg-sky-950/20 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-600" /> Acesso de Gestor Pleno
                  </div>
                  <p className="text-xs text-slate-500">Ao ativar, o profissional recebe acesso irrestrito a todos os menus do sistema.</p>
                </div>
                <Switch checked={isManager} onCheckedChange={handleToggleManager} />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Permissões de Acesso Granulares</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border text-xs">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={permissions.includes(perm.id)}
                        disabled={isManager}
                        onCheckedChange={(checked) => handlePermissionChange(perm.id, !!checked)}
                      />
                      <label htmlFor={`perm-${perm.id}`} className="cursor-pointer select-none">{perm.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Automação de Escala Mensal */}
            <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Preencher Mês Completo Automaticamente
                  </div>
                  <p className="text-xs text-slate-500">Gera toda a grade de plantões do mês sem necessidade de cadastro individual.</p>
                </div>
                <Switch checked={autoGenerateShifts} onCheckedChange={setAutoGenerateShifts} />
              </div>

              {autoGenerateShifts && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">Padrão da Escala</Label>
                    <Select value={schedulePattern} onValueChange={setSchedulePattern}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12x36">12x36 (Dia sim, dia não)</SelectItem>
                        <SelectItem value="5x2">5x2 (Segunda a Sexta)</SelectItem>
                        <SelectItem value="6x1">6x1</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Mês de Referência</Label>
                    <Input type="month" value={monthReference} onChange={(e) => setMonthReference(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Primeiro Plantão</Label>
                    <Input type="date" value={cycleStartDate} onChange={(e) => setCycleStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Setor Padrão</Label>
                    <Select value={defaultSectorId} onValueChange={setDefaultSectorId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {sectors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.specialty})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Início Turno</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Fim Turno</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar e Gerar Grade
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}