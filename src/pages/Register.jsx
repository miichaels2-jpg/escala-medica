import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Loader2, AlertCircle, CheckCircle2, ArrowLeft, ShieldCheck, HeartPulse } from 'lucide-react';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    rqe: '',
    cpf: '',
    birth_date: '',
    document: '',
    phone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.name || !formData.cpf || !formData.birth_date || !formData.phone || !formData.document) {
      setError('Preencha todos os campos obrigatórios (*).');
      return;
    }

    setLoading(true);
    try {
      // Cria a solicitação no banco com status 'pendente'
      const payload = {
        company_id: 'cmp_principal', // Vincula à matriz por padrão
        name: formData.name.trim(),
        specialty: formData.specialty.trim(),
        rqe: formData.rqe.trim(),
        cpf: formData.cpf.trim(),
        birth_date: formData.birth_date,
        document: formData.document.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        status: 'pendente', // Vai direto para a aba de Pendentes do Gestor!
        data: {
          category: 'medico', // Categoria padrão (Gestor pode alterar depois)
          app_role: 'assistencial',
          birth_date: formData.birth_date,
          cpf: formData.cpf,
          rqe: formData.rqe
        }
      };

      const { error: insertErr } = await supabase.from('professionals').insert([payload]);
      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err) {
      setError('Erro ao enviar solicitação. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors duration-500 font-sans">
      
      {/* FUNDO PREMIUM (Watermark Médico + Efeitos Radiais) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M28 20h4v8h8v4h-8v-8h-4v-8h-8v-4h8v-8z\' fill=\'%230ea5e9\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E')] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[60%] bg-sky-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] bg-indigo-600/15 rounded-full blur-[120px]" />
      </div>

      {/* CARD DE SOLICITAÇÃO (Glassmorphism) */}
      <div className="w-full max-w-2xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50 rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10 relative">
        
        {success ? (
          <div className="flex flex-col items-center justify-center text-center py-10 space-y-4 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2 ring-8 ring-emerald-50 dark:ring-emerald-950">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Solicitação Recebida!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Seus dados foram enviados para o departamento de Recursos Humanos e Coordenação Médica. 
              <br/><br/>
              Assim que seu perfil for aprovado e as escalas vinculadas, <b>você receberá suas credenciais de acesso oficiais.</b>
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
                Preencha seus dados profissionais. O acesso ao sistema será gerado após a homologação da coordenação.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Completo Oficial *</Label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="Ex: Carlos Eduardo Silva" 
                  className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                  required 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Especialidade Principal *</Label>
                  <Input 
                    value={formData.specialty} 
                    onChange={e => setFormData({...formData, specialty: e.target.value})} 
                    placeholder="Ex: Clínica Médica" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">RQE</Label>
                  <Input 
                    value={formData.rqe} 
                    onChange={e => setFormData({...formData, rqe: e.target.value})} 
                    placeholder="Ex: 12345" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">CPF *</Label>
                  <Input 
                    value={formData.cpf} 
                    onChange={e => setFormData({...formData, cpf: e.target.value})} 
                    placeholder="000.000.000-00" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Data de Nasc. *</Label>
                  <Input 
                    type="date" 
                    value={formData.birth_date} 
                    onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors cursor-pointer" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Conselho (Ex: CRM) *</Label>
                  <Input 
                    value={formData.document} 
                    onChange={e => setFormData({...formData, document: e.target.value})} 
                    placeholder="Ex: 1234 - RJ" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone / WhatsApp *</Label>
                  <Input 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="(00) 90000-0000" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail Profissional</Label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    placeholder="email@exemplo.com" 
                    className="h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:bg-white dark:focus:bg-slate-900 transition-colors" 
                  />
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