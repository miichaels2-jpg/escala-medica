import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  DollarSign, 
  Landmark, 
  User, 
  Building2, 
  Loader2, 
  RotateCcw, 
  Share2, 
  PlusCircle,
  UserX,
  UserCheck,
  Briefcase,
  Hash,
  Percent
} from 'lucide-react';

const SYSTEM_MODULES = [
  { id: 'minha_escala', label: 'Minha Escala / Agenda' },
  { id: 'trocas_plantao', label: 'Trocas e Doações' },
  { id: 'mural_oportunidades', label: 'Mural de Oportunidades' },
  { id: 'meus_repasses', label: 'Meus Repasses (Extrato Financeiro)' },
  { id: 'escalas_geral', label: 'Visualizar Escala Geral' },
  { id: 'relatorios_basicos', label: 'Relatórios Operacionais' }
];

function computeDefaultPassword(birthDateStr, fullName) {
  if (!birthDateStr) return '123456';
  const parts = birthDateStr.split('-');
  if (parts.length !== 3) return '123456';
  const [yyyy, mm, dd] = parts;
  const initial = (fullName || 'p').trim().charAt(0).toLowerCase();
  return `${dd}${mm}${yyyy}${initial}`;
}

export default function ProfessionalFormDialog({ 
  open, 
  onClose, 
  onSaved, 
  professional, 
  companyId, 
  units = [], 
  specialties = [],
  onOpenNewSpecialty 
}) {
  const [saving, setSaving] = useState(false);

  // Status de Acesso
  const [isActive, setIsActive] = useState(true);

  // Identificação Institucional
  const [registrationCode, setRegistrationCode] = useState(''); // ID / Matrícula interna

  // Enquadramento Contratual / Cooperativa
  const [contractType, setContractType] = useState('cooperado'); // cooperado, pj, rpa, clt
  const [cooperativeName, setCooperativeName] = useState('');
  const [coopTaxRate, setCoopTaxRate] = useState('5'); // Taxa administrativa (%)
  const [pjCnpj, setPjCnpj] = useState('');
  const [pjCorporateName, setPjCorporateName] = useState('');

  // Campos Pessoais & Documentos
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [section, setSection] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');

  // Remuneração
  const [remunerationType, setRemunerationType] = useState('hora');
  const [hourlyRate, setHourlyRate] = useState('120');
  const [dailyRate, setDailyRate] = useState('1500');
  const [monthlySalary, setMonthlySalary] = useState('18000');

  // Dados Bancários & PIX
  const [pixType, setPixType] = useState('cpf');
  const [pixKey, setPixKey] = useState('');
  const [bankInfo, setBankInfo] = useState('');

  // Acesso, Perfil & Módulos (RBAC)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('medico');
  const [allowedModules, setAllowedModules] = useState(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);

  useEffect(() => {
    if (!open) return;

    if (professional) {
      setIsActive(professional.status !== 'inativo');
      setName(professional.name || '');
      setCpf(professional.cpf || '');
      setBirthDate(professional.birth_date || '');
      setSpecialty(professional.specialty || professional.category || 'Clínica Médica');
      setSection(professional.section || '');
      setDocument(professional.document || '');
      setEmail(professional.email || '');
      setPhone(professional.phone || '');
      setUnitId(String(professional.unit_id || units[0]?.id || 'unit_h1'));

      // Matrícula / ID
      setRegistrationCode(professional.registration_code || professional.matricula || `MED-${String(professional.id || '').slice(-4).toUpperCase()}`);

      // Dados Contratuais / Cooperativa
      setContractType(professional.contract_type || 'cooperado');
      setCooperativeName(professional.cooperative_name || '');
      setCoopTaxRate(String(professional.coop_tax_rate ?? '5'));
      setPjCnpj(professional.pj_cnpj || '');
      setPjCorporateName(professional.pj_corporate_name || '');

      // Remuneração
      setRemunerationType(professional.remuneration_type || 'hora');
      setHourlyRate(String(professional.hourly_rate || '120'));
      setDailyRate(String(professional.daily_rate || '1500'));
      setMonthlySalary(String(professional.monthly_salary || '18000'));

      // PIX
      setPixType(professional.pix_type || 'cpf');
      setPixKey(professional.pix_key || '');
      setBankInfo(professional.bank_info || '');

      const userRole = professional.role === 'gestor' || professional.is_manager ? 'gestor' : professional.role === 'coordenador' ? 'coordenador' : 'medico';
      setRole(userRole);

      (async () => {
        try {
          const userEmail = (professional.email || '').toLowerCase().trim();
          if (userEmail) {
            const usersFound = await base44.entities.User.filter({ email: userEmail });
            if (usersFound && usersFound.length > 0) {
              const u = usersFound[0];
              setUsername(u.username || '');
              setPassword(u.password || '123456');
              if (u.data?.allowed_modules) {
                setAllowedModules(u.data.allowed_modules);
              }
              if (u.data?.contract_details) {
                setContractType(u.data.contract_details.type || 'cooperado');
                setCooperativeName(u.data.contract_details.cooperative || '');
                setCoopTaxRate(String(u.data.contract_details.tax_rate ?? '5'));
                setPjCnpj(u.data.contract_details.cnpj || '');
                setPjCorporateName(u.data.contract_details.corporate_name || '');
              }
              return;
            }
          }
        } catch (e) {}
        setUsername(professional.email ? professional.email.split('@')[0] : '');
        setPassword(professional.birth_date ? computeDefaultPassword(professional.birth_date, professional.name) : '123456');
        setAllowedModules(userRole === 'gestor' ? SYSTEM_MODULES.map(m => m.id) : ['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
      })();

    } else {
      setIsActive(true);
      setName('');
      setCpf('');
      setBirthDate('');
      setRegistrationCode(`MED-${Math.floor(1000 + Math.random() * 9000)}`);
      setContractType('cooperado');
      setCooperativeName('Cooperativa Médica');
      setCoopTaxRate('5');
      setPjCnpj('');
      setPjCorporateName('');
      setSpecialty(specialties[0]?.name || 'Clínica Médica');
      setSection('');
      setDocument('');
      setEmail('');
      setPhone('');
      setUsername('');
      setPassword('123456');
      setUnitId(String(units[0]?.id || 'unit_h1'));

      setRemunerationType('hora');
      setHourlyRate('120');
      setDailyRate('1500');
      setMonthlySalary('18000');

      setPixType('cpf');
      setPixKey('');
      setBankInfo('');

      setRole('medico');
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
    }
  }, [open, professional, units, specialties]);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'gestor') {
      setAllowedModules(SYSTEM_MODULES.map(m => m.id));
    } else if (newRole === 'coordenador') {
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses', 'escalas_geral']);
    } else {
      setAllowedModules(['minha_escala', 'trocas_plantao', 'mural_oportunidades', 'meus_repasses']);
    }
  };

  const handleBirthDateChange = (newDate) => {
    setBirthDate(newDate);
    if (!professional) {
      setPassword(computeDefaultPassword(newDate, name));
    }
  };

  const handleNameChange = (newName) => {
    setName(newName);
    if (!professional && birthDate) {
      setPassword(computeDefaultPassword(birthDate, newName));
    }
  };

  const handleResetPassword = () => {
    if (!birthDate) {
      alert('Preencha a Data de Nascimento para gerar a senha padrão!');
      return;
    }
    const defaultPass = computeDefaultPassword(birthDate, name);
    setPassword(defaultPass);
    alert(`Senha padrão calculada: ${defaultPass}`);
  };

  const handleCopyAccess = () => {
    const host = window.location.origin;
    const userDisplay = username || (email ? email.split('@')[0] : 'usuario');
    const passDisplay = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');
    const idDisplay = registrationCode || 'MED-0000';

    const textToCopy = `*ScaleMedic - Seus dados de acesso*\n\nOlá, ${name || 'Profissional'}!\nVocê foi cadastrado na plataforma de gestão hospitalar.\n\n🆔 *Matrícula / ID:* ${idDisplay}\n👤 *Usuário:* ${userDisplay}\n🔑 *Senha:* ${passDisplay}\n🔗 *Acesso:* ${host}/login\n\n⚠️ *Atenção:* Troque sua senha no primeiro acesso.`;

    navigator.clipboard.writeText(textToCopy);
    alert('Dados de acesso e Matrícula copiados!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const numHourly = Number(hourlyRate) || 0;
      const numDaily = Number(dailyRate) || 0;
      const numMonthly = Number(monthlySalary) || 0;
      const numTaxRate = Number(coopTaxRate) || 0;

      // Monta notas societárias rastreáveis para cooperativas / PJ
      const contractSummary = [
        `ID/Matrícula: ${registrationCode}`,
        `Regime: ${contractType.toUpperCase()}`,
        contractType === 'cooperado' ? `Cooperativa: ${cooperativeName || 'Geral'} (Taxa: ${numTaxRate}%)` : null,
        contractType === 'pj' ? `CNPJ: ${pjCnpj} - ${pjCorporateName}` : null
      ].filter(Boolean).join(' | ');

      // PAYLOAD RIGOROSAMENTE LIMPO (apenas colunas do banco de dados)
      const cleanProfPayload = {
        company_id: companyId,
        unit_id: unitId || units[0]?.id,
        name,
        specialty,
        category: specialty,
        role,
        document,
        email,
        phone,
        status: isActive ? 'ativo' : 'inativo',
        remuneration_type: remunerationType,
        hourly_rate: numHourly,
        daily_rate: numDaily,
        monthly_salary: numMonthly,
        pix_type: pixType,
        pix_key: pixKey.trim(),
        bank_info: bankInfo.trim(),
        notes: contractSummary
      };

      if (cpf) cleanProfPayload.cpf = cpf;
      if (birthDate) cleanProfPayload.birth_date = birthDate;
      if (section) cleanProfPayload.section = section;

      // Auto-recuperação contra divergências de schema cache
      const payloadToSend = { ...cleanProfPayload };
      let saved = false;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (professional?.id) {
            await base44.entities.Professional.update(professional.id, payloadToSend);
          } else {
            await base44.entities.Professional.create(payloadToSend);
          }
          saved = true;
          break;
        } catch (dbErr) {
          const colMatch = dbErr.message?.match(/Could not find the '(\w+)' column/i);
          if (colMatch && colMatch[1]) {
            delete payloadToSend[colMatch[1]];
          } else {
            throw dbErr;
          }
        }
      }

      if (!saved) {
        throw new Error('Falha ao persistir dados do profissional no banco.');
      }

      // Sincronização do Usuário (dados societários completos armazenados em JSON no data)
      const userNick = (username || (email ? email.split('@')[0] : name.toLowerCase().replace(/\s+/g, ''))).trim();
      const finalPass = password || (birthDate ? computeDefaultPassword(birthDate, name) : '123456');
      const userEmail = (email || `${userNick}@scalemedic.local`).toLowerCase().trim();

      const userData = {
        company_id: companyId,
        selected_unit_id: unitId,
        app_role: role,
        registration_code: registrationCode,
        allowed_modules: allowedModules,
        permissions: allowedModules,
        is_active: isActive,
        status: isActive ? 'ativo' : 'inativo',
        contract_details: {
          type: contractType,
          cooperative: cooperativeName,
          tax_rate: numTaxRate,
          cnpj: pjCnpj,
          corporate_name: pjCorporateName
        },
        must_change_password: !professional || password === computeDefaultPassword(birthDate, name)
      };

      try {
        const existingUsers = await base44.entities.User.filter({ email: userEmail });
        if (existingUsers.length > 0) {
          await base44.entities.User.update(existingUsers[0].id, {
            username: userNick,
            password: finalPass,
            full_name: name,
            role: role === 'gestor' ? 'admin' : 'user',
            is_active: isActive,
            data: { ...(existingUsers[0].data || {}), ...userData }
          });
        } else {
          await base44.entities.User.create({
            email: userEmail,
            username: userNick,
            password: finalPass,
            full_name: name,
            role: role === 'gestor' ? 'admin' : 'user',
            is_active: isActive,
            data: userData
          });
        }
      } catch (uErr) {
        console.warn('Aviso: Sincronização de usuário:', uErr);
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      alert('Erro ao salvar profissional: ' + (err.message || 'Verifique os dados e tente novamente.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-xl font-bold">
              {professional ? `Editar Perfil Mestre: ${name}` : 'Cadastrar Novo Profissional'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          
          {/* BLOCO DE STATUS: ATIVO / INATIVO */}
          <div className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
            isActive 
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' 
              : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isActive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {isActive ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  Status da Conta: 
                  <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {isActive ? 'ATIVO' : 'INATIVO (ACESSO BLOQUEADO)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {isActive 
                    ? 'O profissional pode fazer login no aplicativo e ser escalado nos plantões.' 
                    : 'O profissional NÃO poderá acessar o sistema e ficará oculto em novas escalas.'}
                </p>
              </div>
            </div>
            <Switch 
              checked={isActive} 
              onCheckedChange={setIsActive} 
            />
          </div>

          {/* MATRÍCULA E DADOS PESSOAIS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-sky-600" /> Matrícula / ID *
              </Label>
              <Input 
                required 
                placeholder="Ex: MED-1042" 
                value={registrationCode} 
                onChange={(e) => setRegistrationCode(e.target.value.toUpperCase())} 
                className="font-mono font-bold"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold">Nome completo *</Label>
              <Input required value={name} onChange={(e) => handleNameChange(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold">CPF *</Label>
              <Input required placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs font-semibold">Data de Nascimento *</Label>
              <Input 
                type="date" 
                required 
                value={birthDate} 
                onChange={(e) => handleBirthDateChange(e.target.value)} 
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Especialidade Principal *</Label>
                {onOpenNewSpecialty && (
                  <button
                    type="button"
                    onClick={onOpenNewSpecialty}
                    className="text-[11px] text-sky-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <PlusCircle className="w-3 h-3" /> Criar
                  </button>
                )}
              </div>
              <Select value={String(specialty || '')} onValueChange={setSpecialty}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {specialties.map((esp) => (
                    <SelectItem key={esp.id || esp.name} value={String(esp.name)}>{esp.name}</SelectItem>
                  ))}
                  {specialties.length === 0 && (
                    <SelectItem value="Clínica Médica">Clínica Médica</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold">Seção / Setor Habilitado</Label>
              <Input placeholder="Ex: UTI Adulto, PA" value={section} onChange={(e) => setSection(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs font-semibold">CRM / COREN (com UF) *</Label>
              <Input required placeholder="Ex: CRM-SP 123456" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold">E-mail Profissional</Label>
              <Input type="email" placeholder="medico@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs font-semibold">WhatsApp / Telefone *</Label>
              <Input required placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          {/* BLOCO SOCIETÁRIO: COOPERATIVAS & PJ */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-600" /> Vínculo Societário & Contratual (Cooperativas e Terceirizados)
              </h4>
              <span className="text-[11px] text-slate-400 font-semibold">Configuração Fiscal</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Regime de Contrato</Label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger className="h-10 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperado">Sócio Cooperado (Cooperativa Médica)</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica (Empresa Médica / PJ)</SelectItem>
                    <SelectItem value="rpa">Autônomo (RPA)</SelectItem>
                    <SelectItem value="clt">CLT / Corpo Clínico Próprio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contractType === 'cooperado' && (
                <>
                  <div>
                    <Label className="text-xs font-semibold">Nome da Cooperativa</Label>
                    <Input 
                      placeholder="Ex: Unimed, Coopego, etc." 
                      value={cooperativeName} 
                      onChange={(e) => setCooperativeName(e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Percent className="w-3 h-3 text-emerald-600" /> Taxa Cooperativa / Fundo (%)
                    </Label>
                    <Input 
                      type="number" 
                      placeholder="Ex: 5" 
                      value={coopTaxRate} 
                      onChange={(e) => setCoopTaxRate(e.target.value)} 
                    />
                  </div>
                </>
              )}

              {contractType === 'pj' && (
                <>
                  <div>
                    <Label className="text-xs font-semibold">CNPJ da Empresa Médica</Label>
                    <Input 
                      placeholder="00.000.000/0001-00" 
                      value={pjCnpj} 
                      onChange={(e) => setPjCnpj(e.target.value)} 
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Razão Social da Clínica</Label>
                    <Input 
                      placeholder="Clínica Médica LTDA" 
                      value={pjCorporateName} 
                      onChange={(e) => setPjCorporateName(e.target.value)} 
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* SEÇÃO 1: CONTRATO & REPASSE FINANCEIRO */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
            <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Parâmetros Financeiros do Contrato (Repasse Automático)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">Modelo de Remuneração</Label>
                <Select value={String(remunerationType || 'hora')} onValueChange={setRemunerationType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hora">Horista (Valor por Hora Trabalhada)</SelectItem>
                    <SelectItem value="diaria">Diarista (Valor Fixo por Plantão)</SelectItem>
                    <SelectItem value="mensal">Salário Fixo Mensal (Contrato Fechado)</SelectItem>
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
                </div>
              )}

              {remunerationType === 'diaria' && (
                <div>
                  <Label className="text-xs font-semibold">Valor por Plantão / Diária (R$)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 1500.00"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                  />
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
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 2: DADOS BANCÁRIOS & CHAVE PIX */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" /> Dados para Pagamento & Chave PIX
              </h4>
              <span className="text-[11px] text-slate-400">Utilizado no fechamento do faturamento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo da Chave PIX</Label>
                <Select value={String(pixType || 'cpf')} onValueChange={setPixType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ (PJ)</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="telefone">Telefone</SelectItem>
                    <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Chave PIX Oficial</Label>
                <Input
                  placeholder="Digite a chave PIX exata para recebimento..."
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>

              <div className="sm:col-span-3">
                <Label className="text-xs font-semibold">Dados Bancários / Cooperativa de Crédito (Sicoob, Sicredi, Unicred, etc.)</Label>
                <Input
                  placeholder="Ex: Sicoob (756) - Cooperativa: 4321 - Conta Corrente / Capital: 12345-6"
                  value={bankInfo}
                  onChange={(e) => setBankInfo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: CONTROLE DE ACESSO & PERMISSÕES */}
          <div className="p-4 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-600" /> Acesso ao Sistema & Perfil de Permissões
                </h4>
                <p className="text-xs text-slate-500">
                  Defina o papel do profissional e as telas que ele poderá acessar.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetPassword}
                  className="text-xs font-medium gap-1.5 bg-amber-50 dark:bg-slate-900 border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                  Resetar Senha
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAccess}
                  className="text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-sky-300 text-sky-700 hover:bg-sky-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Copiar Acesso & Matrícula
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Perfil de Acesso (Papel)</Label>
                <Select value={role} onValueChange={handleRoleChange}>
                  <SelectTrigger className="h-10 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medico">Plantonista (Acesso Próprio & Trocas)</SelectItem>
                    <SelectItem value="coordenador">Coordenador de Setor (Gestão Local)</SelectItem>
                    <SelectItem value="gestor">Diretor / Gestor Geral (Acesso Total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Usuário / Apelido</Label>
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>

              <div>
                <Label className="text-xs font-semibold">Senha Inicial</Label>
                <Input required type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <div className="pt-3 border-t border-sky-200/60 dark:border-sky-800/60 space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Telas e Módulos Liberados para este Profissional:
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {SYSTEM_MODULES.map((mod) => (
                  <label key={mod.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowedModules.includes(mod.id) || role === 'gestor'}
                      disabled={role === 'gestor'}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...allowedModules, mod.id]
                          : allowedModules.filter(m => m !== mod.id);
                        setAllowedModules(next);
                      }}
                      className="rounded border-slate-300 text-sky-600 focus:ring-0"
                    />
                    <span>{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Unidade Hospitalar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Label className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" /> Unidade Hospitalar Vinculada
            </Label>
            <Select value={String(unitId || '')} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {units.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 text-white px-6 font-bold text-xs h-10">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gravando...</> : (professional ? 'Salvar Alterações' : 'Concluir Cadastro')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}