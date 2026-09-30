import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Activity, Loader2, AlertCircle, CheckCircle2, ArrowLeft, 
  ShieldCheck, HeartPulse, DollarSign, Landmark, KeyRound
} from 'lucide-react';

const CATEGORIES = [
  { id: 'medico', label: 'Médico(a)', council: 'CRM' },
  { id: 'enfermeiro', label: 'Enfermeiro(a)', council: 'COREN' },
  { id: 'fisioterapeuta', label: 'Fisioterapeuta', council: 'CREFITO' },
  { id: 'tecnico_enfermagem', label: 'Téc. Enfermagem', council: 'COREN' },
  { id: 'farmaceutico', label: 'Farmacêutico(a)', council: 'CRF' },
  { id: 'nutricionista', label: 'Nutricionista', council: 'CRN' },
  { id: 'psicologo', label: 'Psicólogo(a)', council: 'CRP' },
  { id: 'biomedico', label: 'Biomédico(a)', council: 'CRBM' }
];

export default function Register() {
  const [formData, setFormData] = useState({
    category: 'medico',
    name: '',
    username: '', // NOVO CAMPO: Login desejado
    specialty: '',
    rqe: '',
    cbo: '',
    cpf: '',
    birth_date: '',
    document: '',
    document_expiry: '',
    phone: '',
    email: '',
    pix_type: 'CPF',
    pix_key: '',
    bank_info: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name || !formData.username || !formData.cpf || !formData.birth_date || !formData.phone || !formData.document) {
      setError('Preencha todos os campos obrigatórios (*).');
      return;
    }

    setLoading(true);
    try {
      // Limpeza final do usuário de login para evitar bugs de espaço e caracteres
      const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
      const finalEmail = formData.email.trim() ? formData.email.trim().toLowerCase() : `${cleanUsername}.${Date.now()}@scalemedic.local`;

      const payload = {
        company_id: 'cmp_principal',
        name: formData.name.trim(),
        specialty: formData.specialty.trim(),
        rqe: formData.rqe.trim(),
        cbo: formData.cbo.trim(),
        cpf: formData.cpf.trim(),
        birth_date: formData.birth_date,
        document: formData.document.trim(),
        document_expiry: formData.document_expiry,
        phone: formData.phone.trim(),
        email: finalEmail,
        status: 'pendente', 
        data: {
          category: formData.category,
          username: cleanUsername, // Enviando o usuário desejado para a aba "Pendentes"
          app_role: 'assistencial', 
          birth_date: formData.birth_date,
          cpf: formData.cpf,
          rqe: formData.rqe,
          pix_type: formData.pix_type,
          pix_key: formData.pix_key.trim(),
          bank_info: formData.bank_info.trim()
        }
      };

      const { error: insertErr } = await supabase.from('professionals').insert([payload]);
      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err) {
      setError('Erro ao enviar solicitação. Verifique se o CPF ou E-mail já estão cadastrados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 py-12 relative overflow-hidden transition-colors duration-500 font-sans">
      
      {/* FUNDO PREMIUM */}
      <div className="absolute inset-0 z-0 pointer-events-none fixed">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M28 20h4v8h8v4h-8v-8h-4v-8h-8v-4h8v-8z\' fill=\'%230ea5e9\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] bg-sky-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 relative my-auto">
        
        {success ? (
          <div className="flex flex-col items-center justify-center text-center py-10 space-y-4 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2 ring-8 ring-emerald-50 dark:ring-emerald-950">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Ficha Recebida com Sucesso!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Seus dados foram enviados para o departamento de Recursos Humanos e Coordenação Médica. 
              <br/><br/>
              Assim que seu perfil for aprovado e as escalas e unidades vinculadas, <b>você receberá suas credenciais de acesso oficiais.</b>
            </p>
            <Link to="/login" className="mt-8 inline-block">
              <Button className="h-11 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm px-8 rounded-xl shadow-lg cursor-pointer transition-all">
                Voltar à Tela de Login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/30 mb-4 ring-2 ring-white/50 dark:ring-slate-800">
                <HeartPulse className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Credenciamento Médico</h1>
              <p className="text-xs text-slate-500 font-bold mt-2 text-center max-w-sm">
                Preencha seus dados profissionais abaixo. O RH validará suas informações para a liberação das escalas.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-500">1. Categoria Profissional *</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <div 
                      key={cat.id} 
                      onClick={() => setFormData({ ...formData, category: cat.id })} 
                      className={`p-2 rounded-xl border cursor-pointer text-center transition-all flex flex-col justify-center ${
                        formData.category === cat.id 
                          ? 'border-sky-600 bg-sky-50 dark:bg-sky-900/20 font-black shadow-sm ring-1 ring-sky-600 text-sky-700 dark:text-sky-400' 
                          : 'bg-slate-50/50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white'
                      }`}
                    >
                      <span className="text-[11px] block truncate px-1">{cat.label}</span>
                      <span className="text-[9px] opacity-60 px-1 truncate">Conselho: {cat.council}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase text-slate-500">2. Dados Pessoais & Registro</Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Nome Completo Oficial *</Label>
                    <Input 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      placeholder="Ex: Carlos Eduardo Silva" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-sky-500" /> Usuário Desejado *
                    </Label>
                    <Input 
                      value={formData.username} 
                      onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '')})} 
                      placeholder="Ex: dr.carlos" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-sky-600 focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Especialidade Principal *</Label>
                    <Input 
                      value={formData.specialty} 
                      onChange={e => setFormData({...formData, specialty: e.target.value})} 
                      placeholder="Ex: Clínica Médica" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">RQE</Label>
                    <Input 
                      value={formData.rqe} 
                      onChange={e => setFormData({...formData, rqe: e.target.value})} 
                      placeholder="Ex: 12345" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">CBO</Label>
                    <Input 
                      value={formData.cbo} 
                      onChange={e => setFormData({...formData, cbo: e.target.value})} 
                      placeholder="Ex: 225125" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">CPF *</Label>
                    <Input 
                      value={formData.cpf} 
                      onChange={e => setFormData({...formData, cpf: e.target.value})} 
                      placeholder="000.000.000-00" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Data de Nasc. *</Label>
                    <Input 
                      type="date" 
                      value={formData.birth_date} 
                      onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors cursor-pointer" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Conselho (Ex: CRM) *</Label>
                    <Input 
                      value={formData.document} 
                      onChange={e => setFormData({...formData, document: e.target.value})} 
                      placeholder="Ex: 1234 - RJ" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Validade Cred.</Label>
                    <Input 
                      type="date" 
                      value={formData.document_expiry} 
                      onChange={e => setFormData({...formData, document_expiry: e.target.value})} 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors cursor-pointer" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Telefone / WhatsApp *</Label>
                    <Input 
                      value={formData.phone} 
                      onChange={e => setFormData({...formData, phone: e.target.value})} 
                      placeholder="(00) 90000-0000" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">E-mail Profissional</Label>
                    <Input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      placeholder="email@exemplo.com" 
                      className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    />
                  </div>
                </div>
              </div>

              {/* DADOS BANCÁRIOS / PIX */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-500 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> 3. Faturamento & Recebimento
                </Label>
                
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tipo Chave PIX</Label>
                      <Select value={formData.pix_type} onValueChange={v => setFormData({...formData, pix_type: v})}>
                        <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[99999]">
                          <SelectItem value="CPF">CPF</SelectItem>
                          <SelectItem value="CNPJ">CNPJ</SelectItem>
                          <SelectItem value="Email">E-mail</SelectItem>
                          <SelectItem value="Telefone">Telefone</SelectItem>
                          <SelectItem value="Aleatoria">Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Chave PIX para Repasse Honorários</Label>
                      <Input 
                        value={formData.pix_key} 
                        onChange={e => setFormData({...formData, pix_key: e.target.value})} 
                        className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-slate-400" /> Dados Bancários (Caso não receba via PIX)
                    </Label>
                    <Input 
                      value={formData.bank_info} 
                      onChange={e => setFormData({...formData, bank_info: e.target.value})} 
                      placeholder="Ex: Banco Itaú, Agência 0000, Conta Corrente 00000-0" 
                      className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-xs" 
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 rounded-xl flex items-start gap-2 mt-4">
                <ShieldCheck className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-sky-800 dark:text-sky-300 leading-tight font-medium">
                  Seus dados são protegidos sob a LGPD. As senhas de acesso serão configuradas pela coordenação e você poderá alterá-las em seu primeiro login.
                </p>
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/60 mt-2">
                <Link to="/login" className="w-full sm:w-auto">
                  <Button type="button" variant="ghost" className="w-full h-11 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer">
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar ao Login
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto h-11 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm px-8 rounded-xl shadow-lg shadow-sky-600/20 cursor-pointer transition-all">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...</> : 'Enviar Solicitação'}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}