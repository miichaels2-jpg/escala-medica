import React, { useState, useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Users, Stethoscope, ShieldCheck, AlertTriangle, FileText, 
  Calendar, Plus, Search, CheckCircle2, XCircle, Edit3, Trash2, 
  Phone, Mail, Award, Check, X, ShieldAlert
} from 'lucide-react';

function formatFullName(name) {
  if (!name) return 'Profissional';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function getInitials(name) {
  if (!name) return 'DR';
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function getProfMeta(prof) {
  if (!prof) return {};
  try {
    const stored = window.localStorage.getItem(`prof_meta_${prof.id}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  if (prof.data && typeof prof.data === 'object') return prof.data;
  return {};
}

async function autoHealingSaveProfessional(id, initialPayload) {
  let payload = { ...initialPayload };
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (id) return await base44.entities.Professional.update(id, payload);
      else return await base44.entities.Professional.create(payload);
    } catch (err) {
      const msg = err.message || '';
      const match = msg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) { delete payload[match[1]]; continue; }
      throw err;
    }
  }
}

export default function CorpoClinico() {
  const { professionals = [], sectors = [], company, selectedUnitId, isManager, syncGlobalData } = useAppData();

  const [searchQuery, setSearchQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfId, setEditingProfId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: 'Clínica Médica',
    document: '', // CRM / Registro
    rqe: '', // Registro de Qualificação de Especialidade
    document_expiry: '', // Validade do documento
    status: 'ativo',
    remuneration_type: 'mensal',
    monthly_salary: 1672
  });

  const allSpecialties = useMemo(() => {
    const set = new Set();
    (professionals || []).forEach(p => { if (p?.specialty && p.specialty.trim()) set.add(p.specialty.trim()); });
    return Array.from(set).sort();
  }, [professionals]);

  // Filtragem avançada do corpo clínico
  const filteredProfessionals = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return (professionals || []).filter(p => {
      if (!p) return false;
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      if (specialtyFilter !== 'todas' && (p.specialty || '').toLowerCase() !== specialtyFilter.toLowerCase()) return false;
      
      if (!term) return true;
      return (p.name || '').toLowerCase().includes(term) ||
             (p.document || '').toLowerCase().includes(term) ||
             (p.specialty || '').toLowerCase().includes(term) ||
             (p.email || '').toLowerCase().includes(term);
    });
  }, [professionals, searchQuery, specialtyFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingProfId(null);
    setFormData({
      name: '', email: '', phone: '', specialty: 'Clínica Médica',
      document: '', rqe: '', document_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      status: 'ativo', remuneration_type: 'mensal', monthly_salary: 1672
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (prof) => {
    setEditingProfId(prof.id);
    const meta = getProfMeta(prof);
    let expiry = prof.document_expiry || meta.document_expiry || '';

    setFormData({
      name: prof.name || '',
      email: prof.email || '',
      phone: prof.phone || '',
      specialty: prof.specialty || 'Clínica Médica',
      document: prof.document || '',
      rqe: prof.rqe || (meta.rqe || ''),
      document_expiry: expiry || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
      status: prof.status || 'ativo',
      remuneration_type: prof.remuneration_type || 'mensal',
      monthly_salary: prof.monthly_salary || 1672
    });
    setModalOpen(true);
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Informe o nome do profissional.'); return; }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company?.id || 'cmp_principal',
        unit_id: selectedUnitId || 'unit_h1',
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        specialty: formData.specialty.trim(),
        document: formData.document.trim(),
        rqe: formData.rqe.trim(),
        document_expiry: formData.document_expiry,
        status: formData.status,
        remuneration_type: formData.remuneration_type,
        monthly_salary: parseFloat(formData.monthly_salary) || 1672,
        data: {
          rqe: formData.rqe.trim(),
          document_expiry: formData.document_expiry
        }
      };

      await autoHealingSaveProfessional(editingProfId, payload);
      setModalOpen(false);
      await syncGlobalData();
      alert('Profissional e credenciais salvos com sucesso!');
    } catch (err) {
      alert('Erro ao salvar profissional: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProfessional = async (profId) => {
    if (!confirm('Deseja excluir este profissional do corpo clínico?')) return;
    try {
      await base44.entities.Professional.delete(profId);
      await syncGlobalData();
    } catch (err) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 font-sans bg-slate-100 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
      
      {/* HEADER EXECUTIVO */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-400">
            <Users className="w-4 h-4" /> Governança & Credenciamento
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Corpo Clínico & Documentação</h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Gestão unificada de credenciais médicas, validade de CRM/RQE e status de habilitação para escalas.
          </p>
        </div>

        {isManager && (
          <Button 
            onClick={handleOpenCreate} 
            className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-2xl shadow-lg gap-2 cursor-pointer transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" /> Credenciar Profissional
          </Button>
        )}
      </div>

      {/* BARRA DE FILTROS & BUSCA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Buscar por nome, CRM ou especialidade..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="pl-10 h-10 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl w-44">
              <SelectValue placeholder="Especialidade..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900">
              <SelectItem value="todas">Todas Especialidades</SelectItem>
              {allSpecialties.map(spec => <SelectItem key={spec} value={spec}>{spec}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 text-xs font-bold bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl w-36">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900">
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* GRID DE PROFISSIONAIS */}
      {filteredProfessionals.length === 0 ? (
        <Card className="p-16 text-center border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl space-y-2">
          <Users className="w-12 h-12 text-slate-400 mx-auto opacity-50" />
          <h3 className="text-base font-black text-slate-900 dark:text-white">Nenhum profissional encontrado</h3>
          <p className="text-xs text-slate-500">Ajuste os filtros de busca ou cadastre novos profissionais.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfessionals.map(prof => {
            const meta = getProfMeta(prof);
            const expiry = prof.document_expiry || meta.document_expiry || '';
            const rqeNum = prof.rqe || meta.rqe || 'Não informado';
            const isExpired = expiry && expiry < new Date().toISOString().split('T')[0];

            return (
              <Card 
                key={prof.id} 
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 shadow-sm bg-white dark:bg-slate-900 ${
                  isExpired ? 'border-rose-300 dark:border-rose-900/60' : 'border-slate-200 dark:border-slate-800 hover:border-sky-400'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-black text-xs flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-800">
                        {getInitials(prof.name)}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                          {formatFullName(prof.name)}
                        </h3>
                        <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 block">
                          {prof.specialty || 'Clínica Geral'}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                      prof.status === 'ativo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {prof.status || 'Ativo'}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Registro / CRM:</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{prof.document || 'N/A'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">RQE Especialidade:</span>
                      <strong className="font-mono text-slate-700 dark:text-slate-300">{rqeNum}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Validade Credencial:</span>
                      <strong className={`font-mono ${isExpired ? 'text-rose-500 font-black' : 'text-slate-700 dark:text-slate-300'}`}>
                        {expiry ? expiry.split('-').reverse().join('/') : 'Não informada'} {isExpired && '⚠️'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500 truncate">
                    {prof.phone || prof.email || 'Sem contato'}
                  </div>

                  {isManager && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleOpenEdit(prof)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-sky-600 cursor-pointer"
                        title="Editar Credenciais"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteProfessional(prof.id)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Excluir Profissional"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL DE CREDENCIAMENTO / EDIÇÃO RESPONSIVO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto bg-slate-950 border border-slate-800 text-white shadow-2xl z-[9999] p-5 sm:p-6 rounded-3xl">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-sky-400">
              <Stethoscope className="w-5 h-5 text-sky-400" /> {editingProfId ? 'Editar Credenciais do Profissional' : 'Credenciar Novo Profissional'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveProfessional} className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-300">Nome Completo *</Label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="Ex: Dr. Carlos Eduardo Silva"
                className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" 
                required 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Registro / CRM *</Label>
                <Input 
                  value={formData.document} 
                  onChange={e => setFormData({ ...formData, document: e.target.value })} 
                  placeholder="Ex: 123456-RJ"
                  className="h-10 bg-slate-900 border-slate-700 text-white font-mono rounded-xl" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">RQE (Especialidade)</Label>
                <Input 
                  value={formData.rqe} 
                  onChange={e => setFormData({ ...formData, rqe: e.target.value })} 
                  placeholder="Ex: 45678"
                  className="h-10 bg-slate-900 border-slate-700 text-white font-mono rounded-xl" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Especialidade Principal *</Label>
                <Input 
                  value={formData.specialty} 
                  onChange={e => setFormData({ ...formData, specialty: e.target.value })} 
                  placeholder="Ex: Cardiologista, Cirurgião..."
                  className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Validade da Credencial *</Label>
                <Input 
                  type="date"
                  value={formData.document_expiry} 
                  onChange={e => setFormData({ ...formData, document_expiry: e.target.value })} 
                  className="h-10 bg-slate-900 border-slate-700 text-white font-mono rounded-xl cursor-pointer" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">E-mail de Contato</Label>
                <Input 
                  type="email"
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  placeholder="medico@hospital.com"
                  className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Telefone / WhatsApp</Label>
                <Input 
                  value={formData.phone} 
                  onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                  placeholder="(21) 99999-9999"
                  className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Status Cadastral</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10 bg-slate-900 border-slate-700 text-white rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Remuneração Base (R$)</Label>
                <Input 
                  type="number"
                  value={formData.monthly_salary} 
                  onChange={e => setFormData({ ...formData, monthly_salary: e.target.value })} 
                  className="h-10 bg-slate-900 border-slate-700 text-white font-mono rounded-xl" 
                />
              </div>
            </div>

            <DialogFooter className="pt-3 flex flex-row items-center justify-between border-t border-slate-800 mt-3 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setModalOpen(false)}
                className="h-10 text-xs font-bold border-slate-700 text-slate-300 rounded-xl px-4 cursor-pointer"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="h-10 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-6 rounded-xl shadow-md cursor-pointer"
              >
                Salvar Credenciais
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}