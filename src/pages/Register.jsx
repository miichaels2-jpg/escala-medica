import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [identifiedCompanyId, setIdentifiedCompanyId] = useState('cmp_principal'); 
  const [availableUnits, setAvailableUnits] = useState([]);

  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    email: '',
    phone: '',
    documentNumber: '',
    councilState: 'SP',
    specialty: '',
    unitId: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const comp = await base44.entities.Company?.get(identifiedCompanyId).catch(() => null);
        if (comp && comp.units) {
          setAvailableUnits(comp.units);
          if (comp.units.length > 0) setFormData(prev => ({ ...prev, unitId: comp.units[0].id }));
        }
      } catch (e) {
        console.warn('Sem unidades da empresa localizadas.');
      }
    };
    fetchCompanyData();
  }, [identifiedCompanyId]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!formData.fullName || !formData.cpf || !formData.email || !formData.documentNumber) {
      setError('Preencha todos os campos obrigatórios (*).');
      return;
    }

    setLoading(true);
    try {
      const loginEmail = formData.email.trim().toLowerCase();
      
      // Verifica na tabela de Usuários (sem usar base44.auth)
      const existing = await base44.entities.User.filter({ email: loginEmail });
      if (existing && existing.length > 0) {
        throw new Error('Este e-mail já está cadastrado.');
      }

      // Cria na tabela User (sem auth.register que não existe)
      const newUser = await base44.entities.User.create({
        email: loginEmail,
        username: loginEmail.split('@')[0],
        password: formData.password,
        full_name: formData.fullName.trim(),
        role: 'user', 
        data: {
          company_id: identifiedCompanyId,
          selected_unit_id: formData.unitId,
          status: 'pendente',
          phone: formData.phone,
          document_cpf: formData.cpf,
        }
      });

      if (newUser && base44.entities.Professional?.create) {
        await base44.entities.Professional.create({
          user_id: newUser.id,
          company_id: identifiedCompanyId,
          unit_id: formData.unitId,
          name: formData.fullName.trim(),
          cpf: formData.cpf,
          email: loginEmail,
          phone: formData.phone,
          document: `${formData.documentNumber} - ${formData.councilState}`,
          specialty: formData.specialty,
          status: 'pendente', 
          remuneration_type: 'hora',
          hourly_rate: 0
        });

        if (base44.entities.Notification?.create) {
          await base44.entities.Notification.create({
            company_id: identifiedCompanyId,
            unit_id: formData.unitId,
            recipient_user_id: 'admin',
            title: 'Novo Cadastro Médico',
            message: `Dr(a). ${formData.fullName} solicitou acesso.`,
            is_read: false,
            created_date: new Date().toISOString()
          });
        }
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Ocorreu um erro no credenciamento.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl p-8 shadow-2xl text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Cadastro Solicitado!</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Seus dados foram enviados para a coordenação. Você será avisado quando for aprovado.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">
            Voltar para o Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 py-12">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Credenciamento Médico</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Preencha os dados oficiais para solicitação de acesso.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Completo *</Label>
              <Input name="fullName" value={formData.fullName} onChange={handleChange} placeholder="Seu nome oficial" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">CPF *</Label>
              <Input name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone / WhatsApp *</Label>
              <Input name="phone" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Número do CRM/COREN *</Label>
              <Input name="documentNumber" value={formData.documentNumber} onChange={handleChange} placeholder="Ex: 123456" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">UF do Conselho *</Label>
              <Select value={formData.councilState} onValueChange={(val) => setFormData({...formData, councilState: val})} disabled={loading}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE'].map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Especialidade Principal *</Label>
              <Input name="specialty" value={formData.specialty} onChange={handleChange} placeholder="Ex: Clínica Médica" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail Profissional *</Label>
              <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="medico@hospital.com" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Senha de Acesso *</Label>
              <Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" className="h-10 text-sm" disabled={loading} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Confirme a Senha *</Label>
              <Input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="Repita a senha" className="h-10 text-sm" disabled={loading} />
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
              Já tem cadastro? Voltar ao Login
            </Link>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto h-11 bg-sky-600 hover:bg-sky-700 text-white font-black text-sm px-8 rounded-xl shadow-md">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : 'Solicitar Credenciamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}