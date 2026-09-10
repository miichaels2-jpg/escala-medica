import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Save, UserPlus, Users, Trash2 } from 'lucide-react';

export default function Configuracoes() {
  const { user, company, loading, refresh } = useAppData();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: '', app_name: '', cnpj: '', phone: '', address: '', primary_contact: '', logo_url: '', accent_color: '#0ea5e9' });
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [companyUsers, setCompanyUsers] = useState([]);

  const isAdmin = user?.role === 'admin';
  const companyId = user?.data?.company_id;

  const loadCompanies = async () => {
    try {
      setCompanies(await base44.entities.Company.list('-created_date', 100));
    } catch (e) {}
  };

  const loadUsers = async () => {
    try {
      setCompanyUsers(await base44.entities.User.list('-created_date', 100));
    } catch (e) {}
  };

  useEffect(() => {
    if (loading) return;
    if (isAdmin) loadCompanies();
    loadUsers();
    if (company) setForm({ name: company.name || '', app_name: company.app_name || '', cnpj: company.cnpj || '', phone: company.phone || '', address: company.address || '', primary_contact: company.primary_contact || '', logo_url: company.logo_url || '', accent_color: company.accent_color || '#0ea5e9' });
  }, [loading, company, isAdmin]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      set('logo_url', e.target?.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (company) {
        await base44.entities.Company.update(company.id, form);
      } else {
        const created = await base44.entities.Company.create(form);
        await base44.auth.updateMe({ data: { company_id: created.id, app_role: 'manager' } });
      }
      refresh();
    } catch (err) {
      alert(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCompany = async (id) => {
    await base44.auth.updateMe({ data: { company_id: id } });
    refresh();
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteEmail('');
      loadUsers();
      alert('Convite enviado com sucesso!');
    } catch (err) {
      alert(err.message || 'Erro ao convidar');
    }
  };

  if (loading) return <div className="p-8 text-slate-400">Carregando...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><Building2 className="w-5 h-5 text-sky-600" /> Dados da Empresa</h3>
        <p className="text-sm text-slate-500 mb-4">{company ? 'Edite as informações da sua instituição' : 'Cadastre sua empresa para começar a usar o MedScale'}</p>
        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome da empresa *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do app / marca</Label>
              <Input value={form.app_name} onChange={(e) => set('app_name', e.target.value)} placeholder="ScaleMedic CGT" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contato principal</Label>
              <Input value={form.primary_contact} onChange={(e) => set('primary_contact', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Logo da empresa</Label>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (e) => set('logo_url', e.target?.result || '');
                    reader.readAsDataURL(file);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </div>
              {form.logo_url && (
                <img src={form.logo_url} alt="Logo da empresa" className="mt-3 h-16 w-16 rounded-lg object-cover border border-slate-200" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Cor principal da marca</Label>
              <Input type="color" value={form.accent_color} onChange={(e) => set('accent_color', e.target.value)} className="h-10 p-1" />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço da unidade</Label>
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : <><Save className="w-4 h-4 mr-1.5" /> Salvar</>}
          </Button>
        </form>
      </Card>

      {isAdmin && (
        <Card className="p-6 border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><Building2 className="w-5 h-5 text-sky-600" /> Empresas (Admin do Sistema)</h3>
          <p className="text-sm text-slate-500 mb-4">Como administrador do MedScale, você gerencia todas as empresas. Selecione uma para atuar nela.</p>
          {companies.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma empresa cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.cnpj || 'Sem CNPJ'} · Plano: {c.plan || 'trial'}</div>
                  </div>
                  <Button variant={company?.id === c.id ? 'default' : 'outline'} size="sm" onClick={() => handleSelectCompany(c.id)}>
                    {company?.id === c.id ? 'Ativa' : 'Selecionar'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><UserPlus className="w-5 h-5 text-sky-600" /> Convidar Usuário</h3>
        <p className="text-sm text-slate-500 mb-4">Envie um convite para um gestor ou profissional acessar o sistema</p>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <Input type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="flex-1" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="h-10 rounded-md border border-slate-200 px-3 text-sm bg-white">
            <option value="user">Usuário (Profissional)</option>
            <option value="admin">Administrador</option>
          </select>
          <Button type="submit"><UserPlus className="w-4 h-4 mr-1.5" /> Convidar</Button>
        </form>
      </Card>

      <Card className="p-6 border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-sky-600" /> Usuários do Sistema</h3>
        {companyUsers.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum usuário.</p>
        ) : (
          <div className="space-y-2">
            {companyUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-slate-700">{u.full_name || u.email}</div>
                  <div className="text-xs text-slate-400">{u.email} · {u.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{u.role}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}