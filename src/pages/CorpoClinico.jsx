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
  ShieldCheck, 
  Calendar, 
  Building2, 
  Plus, 
  Edit3, 
  Loader2, 
  Clock, 
  Mail, 
  Phone, 
  User, 
  CheckCircle2, 
  PlusCircle,
  Share2,
  RotateCcw,
  DollarSign
} from 'lucide-react';

const ALL_PERMISSIONS = [
  { id: 'painel', label: 'Painel Geral' },
  { id: 'escalas', label: 'Gestão de Escalas' },
  { id: 'trocas', label: 'Trocas de Plantão' },
  { id: 'corpo-clinico', label: 'Corpo Clínico' },
  { id: 'relatorios', label: 'Relatórios' },
  { id: 'faturamento', label: 'Faturamento e Repasse' },
  { id: 'configuracoes', label: 'Configurações' }
];

const HOSPITAL_SCHEDULE_PATTERNS = [
  { id: '12x36_D', label: '12x36 Diurno (07:00 às 19:00)', pattern: '12x36', start: '07:00', end: '19:00', hours: 12 },
  { id: '12x36_N', label: '12x36 Noturno (19:00 às 07:00)', pattern: '12x36', start: '19:00', end: '07:00', hours: 12 },
  { id: '24x72', label: '24x72 Integral (07:00 às 07:00)', pattern: '24x72', start: '07:00', end: '07:00', hours: 24 },
  { id: '24x48', label: '24x48 Extensivo (07:00 às 07:00)', pattern: '24x48', start: '07:00', end: '07:00', hours: 24 },
  { id: '5x2_COMERCIAL', label: '5x2 Ambulatório (08:00 às 17:00)', pattern: '5x2', start: '08:00', end: '17:00', hours: 8 },
  { id: '5x2_MANHA', label: '5x2 Manhã (07:00 às 13:00)', pattern: '5x2', start: '07:00', end: '13:00', hours: 6 },
  { id: '5x2_TARDE', label: '5x2 Tarde (13:00 às 19:00)', pattern: '5x2', start: '13:00', end: '19:00', hours: 6 },
  { id: '6x1_MANHA', label: '6x1 Manhã (07:00 às 13:00)', pattern: '6x1', start: '07:00', end: '13:00', hours: 6 },
  { id: '6x1_TARDE', label: '6x1 Tarde (13:00 às 19:00)', pattern: '6x1', start: '13:00', end: '19:00', hours: 6 },
  { id: '6x1_NOITE', label: '6x1 Noite (19:00 às 01:00)', pattern: '6x1', start: '19:00', end: '01:00', hours: 6 },
  { id: 'CUSTOM', label: 'Horário Personalizado', pattern: 'custom', start: '07:00', end: '19:00', hours: 12 }
];

const DEFAULT_SECTORS = [
  { id: 'sec_uti_adulto', name: 'UTI Adulto', specialty: 'Medicina Intensiva' },
  { id: 'sec_emergencia', name: 'Emergência / Pronto-Socorro', specialty: 'Emergência' },
  { id: 'sec_bloco_cirurgico', name: 'Bloco Cirúrgico', specialty: 'Cirurgia Geral' },
  { id: 'sec_cardiologia', name: 'Cardiologia / UCO', specialty: 'Cardiologia' },
  { id: 'sec_pediatria', name: 'Pediatria e Pronto Atendimento', specialty: 'Pediatria' },
  { id: 'sec_clinica_medica', name: 'Enfermaria / Clínica Médica', specialty: 'Clínica Médica' }
];

function computeDefaultPassword(birthDateStr, fullName) {
  if (!birthDateStr) return '123456';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return '123456';
  const [yyyy, mm, dd] = parts;
  const initial = (fullName || 'p').trim().charAt(0).toLowerCase();
  return `${dd}${mm}${yyyy}${initial}`;
}

export default function CorpoClinico() {
  const { user, company } = useAppData();
  const [professionals, setProfessionals] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');

  const [newSpecialtyModal, setNewSpecialtyModal] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [savingSpecialty, setSavingSpecialty] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [section, setSection] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  
  // Remuneração e Financeiro
  const [remunerationType, setRemunerationType] = useState('hora'); // 'hora', 'diaria', 'mensal'
  const [hourlyRate, setHourlyRate] = useState('120');
  const [dailyRate, setDailyRate] = useState('1500');
  const [monthlySalary, setMonthlySalary] = useState('18000');

  // Acesso / Credenciais
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [permissions, setPermissions] = useState(['painel', 'escalas', 'trocas']);

  // Padrão de Escala Automática
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
      const [profs, secs, specs] = await Promise.all([
        base44.entities.Professional.filter({ company_id: companyId }, '-created_date', 300),
        base44.entities.Sector.filter({ company_id: companyId }, 'name', 100),
        base44.entities.Specialty ? base44.entities.Specialty.filter({ company_id: companyId }, 'name', 100) : []
      ]);
      setProfessionals(profs || []);
      setSectors((secs && secs.length > 0) ? secs : DEFAULT_SECTORS);
      setSpecialties(specs || []);
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
      setSectors(DEFAULT_SECTORS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

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

  const handleBirthDateChange = (newDate) => {
    setBirthDate(newDate);
    if (!editingId) {
      setPassword(computeDefaultPassword(newDate, name));
    }
  };

  const handleNameChange = (newName) => {
    setName(newName);
    if (!editingId && birthDate) {
      setPassword(computeDefaultPassword(birthDate, newName));
    }
  };

  const handleResetPassword = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!birthDate) {
      alert('Preencha a Data de Nascimento para gerar a senha padrão!');
      return;
    }

    const defaultPass = computeDefaultPassword(birthDate, name);
    setPassword(defaultPass);

    if (editingId && email) {
      try {
        const userEmail = email.toLowerCase().trim();
        const existingUsers = await base44.entities.User.filter({ email: userEmail });
        if (existingUsers.length > 0) {
          const userRecord = existingUsers[0];
          await base44.entities.User.update(userRecord.id, {
            password: defaultPass,
            data: { ...(userRecord.data || {}), must_change_password: true }
          });
        }
      } catch (err) {
        console.error('Erro ao resetar senha no banco:', err);
      }
    }

    setToastMessage(`Senha reiniciada para: ${defaultPass}`);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const openNewModal = () => {
    setEditingId(null);
    setName('');
    setCpf('');
    setBirthDate('');
    setSpecialty(specialties[0]?.name || 'Clínica Médica');
    setSection('');
    setDocument('');
    setEmail('');
    setPhone('');
    setUsername('');
    setPassword('123456');
    setUnitId(units[0]?.id || 'unit_h1');
    setIsManager(false);
    setPermissions(['painel', 'escalas', 'trocas']);
    
    // Remuneração padrão
    setRemunerationType('hora');
    setHourlyRate('120');
    setDailyRate('1500');
    setMonthlySalary('18000');

    setSelectedPatternPreset('12x36_D');
    setSchedulePattern('12x36');
    setMonthReference('2026-09');
    setCycleStartDate('2026-09-01');
    setStartTime('07:00');
    setEndTime('19:00');
    setDurationHours(12);
    setDefaultSectorId(sectors[0]?.id || DEFAULT_SECTORS[0].id);
    setAutoGenerateShifts(true);
    setDialogOpen(true);
  };

  const handleEditProfessional = async (prof) => {
    setEditingId(prof.id);
    setName(prof.name || '');
    setCpf(prof.cpf || '');
    setBirthDate(prof.birth_date || '');
    setSpecialty(prof.specialty || prof.category || 'Clínica Médica');
    setSection(prof.section || prof.role || '');
    setDocument(prof.document || '');
    setEmail(prof.email || '');
    setPhone(prof.phone || '');
    setUnitId(prof.unit_id || units[0]?.id || 'unit_h1');

    // Carrega remuneração
    setRemunerationType(prof.remuneration_type || 'hora');
    setHourlyRate(String(prof.hourly_rate || '120'));
    setDailyRate(String(prof.daily_rate || '1500'));
    setMonthlySalary(String(prof.monthly_salary || '18000'));

    const managerRole = String(prof.role || '').toLowerCase().includes('gestor') || prof.permissions?.includes('configuracoes');
    setIsManager(managerRole);
    setPermissions(Array.isArray(prof.permissions) && prof.permissions.length > 0 
      ? prof.permissions 
      : managerRole ? ALL_PERMISSIONS.map(p => p.id) : ['painel', 'escalas', 'trocas']
    );

    try {
      const usersFound = await base44.entities.User.filter({ email: (prof.email || '').toLowerCase().trim() });
      if (usersFound.length > 0) {
        setUsername(usersFound[0].username || '');
        setPassword(usersFound[0].password || '123456');
      } else {
        setUsername(prof.email ? prof.email.split('@')[0] : '');
        setPassword(prof.birth_date ? computeDefaultPassword(prof.birth_date, prof.name) : '123456');
      }
    } catch {
      setUsername(prof.email ? prof.email.split('@')[0] : '');
      setPassword(prof.birth_date ? computeDefaultPassword(prof.birth_date, prof.name) : '123456');
    }

    setSchedulePattern(prof.schedule_pattern || '12x36');
    setStartTime(prof.schedule_start_time || '07:00');
    setEndTime(prof.schedule_end_time || '19:00');
    setDefaultSectorId(prof.default_sector_id || sectors[0]?.id || DEFAULT_SECTORS[0].id);
    setAutoGenerateShifts(false);

    const matchingPreset = HOSPITAL_SCHEDULE_PATTERNS.find(
      (p) => p.pattern === prof.schedule_pattern && p.start === prof.schedule_start_time && p.end === prof.schedule_end_time
    );
    setSelectedPatternPreset(matchingPreset ? matchingPreset.id : 'CUSTOM');

    setDialogOpen(true);
  };

  const handleCreateSpecialty = async () => {
    if (!newSpecialtyName.trim()) return;
    setSavingSpecialty(true);
    try {
      const created = await base44.entities.Specialty.create({
        company_id: companyId,
        name: newSpecialtyName.trim()
      });
      setSpecialties((prev) => [...prev, created]);
      setSpecialty(created.name);
      setNewSpecialtyName('');
      setNewSpecialtyModal(false);
    } catch (e) {
      alert('Erro ao criar especialidade: ' + e.message);
    } finally {
      setSavingSpecialty(false);
    }
  };

  const handleCreateSectorPrompt = async () => {
    const nomeSetor = prompt('Digite o nome do novo setor hospitalar:');
    if (nomeSetor && nomeSetor.trim()) {
      try {
        const novo = await base44.entities.Sector.create({
          company_id: companyId,
          unit_id: unitId || units[0]?.id || 'unit_h1',
          name: nomeSetor.trim(),
          specialty: specialty || 'Geral',
          active: true
        });
        setSectors((prev) => [...prev, novo]);
        setDefaultSectorId(novo.id);
      } catch (err) {
        alert('Erro ao cadastrar setor: ' + err.message);
      }
    }
  };

  const handleCopyAccess = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const host = window.location.origin;
    const userDisplay = username || (email ? email.split('@')[0] : 'usuario');
    const passDisplay = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');

    const textToCopy = `*ScaleMedic - Seus dados de acesso*\n\nOlá, ${name || 'Profissional'}!\nVocê foi cadastrado no sistema da escala hospitalar.\n\n👤 *Usuário / Apelido:* ${userDisplay}\n🔑 *Senha Provisória:* ${passDisplay}\n🔗 *Acesso:* ${host}/login\n\n⚠️ *Atenção:* Ao acessar o aplicativo de escala, é obrigatório trocar a senha. A nova senha deve ter no mínimo 7 e no máximo 20 caracteres (formato livre: letras, números, símbolos ou acentos).`;

    const triggerSuccess = () => {
      setToastMessage('Copiado com sucesso!');
      setTimeout(() => setToastMessage(''), 3000);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => triggerSuccess())
        .catch(() => fallbackCopyText(textToCopy, triggerSuccess));
    } else {
      fallbackCopyText(textToCopy, triggerSuccess);
    }
  };

  const fallbackCopyText = (text, callback) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      callback();
    } catch (err) {
      console.error('Erro no fallback de cópia:', err);
    }
  };

  // Calcula o valor estimado de um plantão com base nas regras de remuneração
  const computeShiftRepasseValue = (hours) => {
    const parsedHours = Number(hours) || 12;
    if (remunerationType === 'hora') {
      return parsedHours * (Number(hourlyRate) || 0);
    }
    if (remunerationType === 'diaria') {
      return Number(dailyRate) || 0;
    }
    // Salário fixo: o repasse é computado na folha mensal
    return 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const finalRole = isManager ? 'Diretor Médico / Gestor' : (section ? `${specialty} - ${section}` : specialty);

      const numHourly = Number(hourlyRate) || 0;
      const numDaily = Number(dailyRate) || 0;
      const numMonthly = Number(monthlySalary) || 0;

      const profPayload = {
        company_id: companyId,
        unit_id: unitId || units[0]?.id,
        name,
        specialty,
        category: specialty,
        role: finalRole,
        document,
        email,
        phone,
        status: 'ativo',
        permissions: isManager ? ALL_PERMISSIONS.map((p) => p.id) : permissions,
        schedule_pattern: schedulePattern,
        schedule_start_time: startTime,
        schedule_end_time: endTime,
        default_sector_id: defaultSectorId,
        remuneration_type: remunerationType,
        hourly_rate: numHourly,
        daily_rate: numDaily,
        monthly_salary: numMonthly
      };

      if (cpf) profPayload.cpf = cpf;
      if (birthDate) profPayload.birth_date = birthDate;
      if (section) profPayload.section = section;

      let profRecord;
      try {
        if (editingId) {
          profRecord = await base44.entities.Professional.update(editingId, profPayload);
        } else {
          profRecord = await base44.entities.Professional.create(profPayload);
        }
      } catch (err) {
        if (err.message && (err.message.includes('section') || err.message.includes('cpf') || err.message.includes('birth_date'))) {
          delete profPayload.section;
          delete profPayload.cpf;
          delete profPayload.birth_date;
          if (editingId) {
            profRecord = await base44.entities.Professional.update(editingId, profPayload);
          } else {
            profRecord = await base44.entities.Professional.create(profPayload);
          }
        } else {
          throw err;
        }
      }

      // Salva usuário com flag de troca de senha no 1º login
      const userNick = (username || (email ? email.split('@')[0] : name.toLowerCase().replace(/\s+/g, ''))).trim();
      const finalPass = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');
      const userEmail = (email || `${userNick}@scalemedic.local`).toLowerCase().trim();

      const finalPermissions = isManager ? ALL_PERMISSIONS.map((p) => p.id) : permissions;
      const userData = {
        company_id: companyId,
        selected_unit_id: unitId,
        app_role: isManager ? 'manager' : 'professional',
        permissions: finalPermissions,
        must_change_password: !editingId || password === computeDefaultPassword(birthDate, name)
      };

      const existingUsers = await base44.entities.User.filter({ email: userEmail });
      if (existingUsers.length > 0) {
        await base44.entities.User.update(existingUsers[0].id, {
          username: userNick,
          password: finalPass,
          full_name: name,
          role: isManager ? 'admin' : 'user',
          data: { ...(existingUsers[0].data || {}), ...userData }
        });
      } else {
        await base44.entities.User.create({
          email: userEmail,
          username: userNick,
          password: finalPass,
          full_name: name,
          role: isManager ? 'admin' : 'user',
          data: userData
        });
      }

      // Geração da Grade Mensal & Lançamento Automático em Faturamento
      if (autoGenerateShifts && profRecord?.id) {
        const [yearStr, monthStr] = monthReference.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const totalDays = new Date(year, month + 1, 0).getDate();
        const sectorObj = sectors.find((s) => s.id === defaultSectorId) || DEFAULT_SECTORS[0];

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
            const conflict = existingShifts.find(
              (sh) => sh.date === dateStr && sh.unit_id !== unitId && sh.status !== 'cancelado'
            );

            if (conflict) {
              const conflictUnit = units.find((u) => u.id === conflict.unit_id)?.name || 'outra unidade';
              alert(`Aviso: No dia ${dateStr}, o profissional ${name} já possui plantão na unidade "${conflictUnit}".`);
              continue;
            }

            const repasseValue = computeShiftRepasseValue(durationHours);

            shiftsToCreate.push({
              company_id: companyId,
              unit_id: unitId || units[0]?.id,
              sector_id: defaultSectorId || sectorObj.id,
              sector_name: sectorObj?.name || 'Geral',
              professional_id: profRecord.id,
              professional_name: name,
              date: dateStr,
              start_time: startTime,
              end_time: endTime,
              shift_type: startTime >= '18:00' ? 'noturno' : 'diurno',
              status: 'confirmado',
              duration_hours: durationHours,
              shift_value: repasseValue
            });
          }
        }

        for (const sh of shiftsToCreate) {
          const createdShift = await base44.entities.Shift.create(sh);
          // Lança o registro financeiro na tabela billing_records
          if (createdShift && createdShift.id) {
            await base44.entities.BillingRecord.create({
              company_id: companyId,
              unit_id: unitId || units[0]?.id,
              shift_id: createdShift.id,
              professional_id: profRecord.id,
              professional_name: name,
              date: sh.date,
              hours: sh.duration_hours,
              value: sh.shift_value || 0,
              status: 'confirmado'
            });
          }
        }
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message || 'Erro ao processar dados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 relative">
      {/* Toast Notificação */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[9999] flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-100" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Corpo Clínico & Escalas</h1>
          <p className="text-sm text-slate-500">
            Gerencie profissionais, defina regras de repasse financeiro e gere credenciais de acesso direto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewSpecialtyModal(true)} className="gap-2">
            <PlusCircle className="w-4 h-4 text-sky-600" /> Nova Especialidade
          </Button>
          <Button onClick={openNewModal} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 font-medium px-5">
            <Plus className="w-4 h-4" /> Cadastrar profissional
          </Button>
        </div>
      </div>

      {/* Grid de Profissionais */}
      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : professionals.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300">
          <p className="text-slate-500">Nenhum profissional cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {professionals.map((prof) => {
            const unitName = units.find((u) => u.id === prof.unit_id)?.name || 'Hospital Santa Clara';
            const isGestor = String(prof.role || '').toLowerCase().includes('gestor');

            const remType = prof.remuneration_type || 'hora';
            const remLabel = 
              remType === 'hora' ? `R$ ${Number(prof.hourly_rate || 0).toLocaleString('pt-BR')}/hora` :
              remType === 'diaria' ? `R$ ${Number(prof.daily_rate || 0).toLocaleString('pt-BR')}/plantão` :
              `R$ ${Number(prof.monthly_salary || 0).toLocaleString('pt-BR')}/mês (Fixo)`;

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
                        {prof.specialty || prof.category || 'Clínica Geral'} {prof.section ? `• Seção: ${prof.section}` : ''}
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
                    
                    <div className="flex flex-wrap gap-x-3 text-slate-500">
                      {prof.cpf && <span>CPF: <b className="font-mono text-slate-700 dark:text-slate-300">{prof.cpf}</b></span>}
                      {prof.birth_date && <span>Nasc: <b className="text-slate-700 dark:text-slate-300">{prof.birth_date.split('-').reverse().join('/')}</b></span>}
                    </div>

                    {/* Destaque da Remuneração / Repasse */}
                    <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200/60">
                      <DollarSign className="w-3.5 h-3.5 shrink-0" />
                      <span>Repasse: {remLabel}</span>
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
                  </div>
                </div>

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

      {/* Modal de Cadastro & Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingId ? `Editar Cadastro: ${name}` : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-2">
            {/* Dados Pessoais & Documentos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">Nome completo</Label>
                <Input required value={name} onChange={(e) => handleNameChange(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">CPF do Profissional</Label>
                <Input required placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs font-semibold">Data de Nascimento</Label>
                <Input 
                  type="date" 
                  required 
                  value={birthDate} 
                  onChange={(e) => handleBirthDateChange(e.target.value)} 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold">Especialidade</Label>
                  <button
                    type="button"
                    onClick={() => setNewSpecialtyModal(true)}
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <PlusCircle className="w-3 h-3" /> Criar nova
                  </button>
                </div>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger><SelectValue placeholder="Selecione a especialidade..." /></SelectTrigger>
                  <SelectContent>
                    {specialties.map((esp) => (
                      <SelectItem key={esp.id || esp.name} value={esp.name}>{esp.name}</SelectItem>
                    ))}
                    {specialties.length === 0 && (
                      <SelectItem value="Clínica Médica">Clínica Médica</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Seção / Setor</Label>
                <Input required placeholder="Ex: UTI Adulto, Bloco Cirúrgico, PA" value={section} onChange={(e) => setSection(e.target.value)} />
              </div>

              <div>
                <Label className="text-xs font-semibold">Registro / Conselho (CRM / COREN)</Label>
                <Input required value={document} onChange={(e) => setDocument(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                <Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* SEÇÃO: REMUNERAÇÃO, PLANTÕES E REPASSE FINANCEIRO */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> Modelo de Remuneração e Repasse
                  </h4>
                  <p className="text-xs text-slate-500">
                    Define como o valor do plantão é calculado e computado automaticamente no Faturamento.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Tipo de Remuneração</Label>
                  <Select value={remunerationType} onValueChange={setRemunerationType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hora">Horista (Valor por Hora Trabalhada)</SelectItem>
                      <SelectItem value="diaria">Diarista (Valor Fixo por Plantão / Diária)</SelectItem>
                      <SelectItem value="mensal">Salário Fixo Mensal (Contrato Mensal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {remunerationType === 'hora' && (
                  <div>
                    <Label className="text-xs font-semibold">Valor da Hora (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 120.00"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Estimativa: 12h = R$ {(Number(hourlyRate || 0) * 12).toLocaleString('pt-BR')} por plantão.
                    </p>
                  </div>
                )}

                {remunerationType === 'diaria' && (
                  <div>
                    <Label className="text-xs font-semibold">Valor por Diária / Plantão (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 1500.00"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Valor integral fixo creditado para cada plantão realizado.
                    </p>
                  </div>
                )}

                {remunerationType === 'mensal' && (
                  <div>
                    <Label className="text-xs font-semibold">Salário Fixo Mensal (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Ex: 18000.00"
                      value={monthlySalary}
                      onChange={(e) => setMonthlySalary(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Valor total repassado mensalmente na folha de fechamento.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Credenciais de Acesso & Reiniciar Senha */}
            <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-600" /> Acesso ao Sistema (Login & Senha Padrão)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Senha padrão calculada: <b>Data de Nascimento + 1ª letra do nome</b> (Ex: 02051993m).
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetPassword}
                    className="text-xs font-medium gap-1.5 bg-amber-50 dark:bg-slate-900 border-amber-300 text-amber-800 hover:bg-amber-100"
                    title="Reinicia para a senha padrão da data de nascimento"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    Reiniciar Senha
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAccess}
                    className="text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-sky-300 text-sky-700 hover:bg-sky-50"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Copiar WhatsApp
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Nome de Usuário / Apelido</Label>
                  <Input
                    required
                    placeholder="Ex: dr.silva ou michael"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Senha Inicial / Provisória</Label>
                  <Input
                    required
                    type="text"
                    placeholder="Ex: 02051993m"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">E-mail (para login e recuperação)</Label>
                  <Input
                    type="email"
                    placeholder="medico@hospital.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Unidade Hospitalar de Lotação */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" /> Unidade Hospitalar
              </Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Acesso de Gestor */}
            <div className="border border-indigo-100 dark:border-indigo-950 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" /> Cadastrar como Gestor Pleno
                  </div>
                  <p className="text-xs text-slate-500">
                    Ao ativar, o profissional tem acesso irrestrito a todos os menus e aprovações.
                  </p>
                </div>
                <Switch checked={isManager} onCheckedChange={handleToggleManager} />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block">Permissões Específicas</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <div key={perm.id} className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-lg border text-xs">
                      <Checkbox
                        id={`perm-${perm.id}`}
                        checked={permissions.includes(perm.id)}
                        disabled={isManager}
                        onCheckedChange={(checked) => handlePermissionChange(perm.id, !!checked)}
                      />
                      <label htmlFor={`perm-${perm.id}`} className="cursor-pointer select-none font-medium">{perm.label}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Padrão da Escala Hospitalar */}
            <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" /> Escala e Grade do Mês
                  </div>
                  <p className="text-xs text-slate-500">
                    Defina o turno padrão e gere todos os plantões do mês sem esforço manual.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Preencher mês:</span>
                  <Switch checked={autoGenerateShifts} onCheckedChange={setAutoGenerateShifts} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Padrão de Escala Hospitalar</Label>
                  <Select value={selectedPatternPreset} onValueChange={handlePatternPresetChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOSPITAL_SCHEDULE_PATTERNS.map((pattern) => (
                        <SelectItem key={pattern.id} value={pattern.id}>{pattern.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs font-semibold">Setor Padrão</Label>
                    <button
                      type="button"
                      onClick={handleCreateSectorPrompt}
                      className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      <PlusCircle className="w-3 h-3" /> Criar novo setor
                    </button>
                  </div>
                  <Select value={defaultSectorId} onValueChange={setDefaultSectorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                    <SelectContent>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {autoGenerateShifts && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">Mês da Grade</Label>
                    <Input type="month" value={monthReference} onChange={(e) => setMonthReference(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">Data do 1º Plantão</Label>
                    <Input type="date" value={cycleStartDate} onChange={(e) => setCycleStartDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white px-6">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...</> : (editingId ? 'Salvar Alterações' : 'Concluir Cadastro')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Criar Nova Especialidade */}
      <Dialog open={newSpecialtyModal} onOpenChange={setNewSpecialtyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Especialidade Médica</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Nome da Especialidade</Label>
            <Input
              autoFocus
              placeholder="Ex: Neurocirurgia, Radiologia, Nefrologia"
              value={newSpecialtyName}
              onChange={(e) => setNewSpecialtyName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSpecialtyModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateSpecialty} disabled={savingSpecialty} className="bg-sky-600 text-white">
              {savingSpecialty ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Especialidade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}