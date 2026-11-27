import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/lib/useAppData';
import { supabase } from '@/lib/supabase';
import { isProfessionalAuthorizedForSector } from '@/lib/sectorAccess';
import { isIdleExtraSlot, isShiftVacant } from '@/lib/shiftLiveStatus';
import { WEEKDAY_INITIALS, getSectorTemplates, templateSummary, vacanciesPerDay, withSectorTemplates } from '@/lib/sectorTemplates';
import { RATE_COLUMNS, getSectorRates, withSectorRates } from '@/lib/financialCalculations';
import { formatCurrency, getLocalDateString } from '@/lib/format';
import { isShiftPublished } from '@/lib/sharedState';
import { useUnitScope } from '@/lib/unitScope';
import { setUnitScope } from '@/lib/useAppData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/PageHero';
import EmptyState from '@/components/EmptyState';
import SpecialtyPicker from '@/components/SpecialtyPicker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Building2, Plus, Search, Edit, Trash2,
  Save, X, Clock, Users, CalendarPlus, DollarSign
} from 'lucide-react';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const newTurn = (specialty = '') => ({ key: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, specialty, start_time: '07:00', end_time: '19:00', quantity: 1, extra_quantity: 0, extra_weekdays: [] });

export default function Setores() {
  const { sectors: unitSectors = [], shifts: unitShifts = [], professionals: unitProfessionals = [], allCompanySectors = [], allCompanyShifts = [], allCompanyProfessionals = [], company, selectedUnitId, syncGlobalData, user, isManager, getPublishedRanges } = useAppData();
  // "Todas as unidades" (V0.9.7): setores de todas as unidades administradas, cada um com a sua unidade.
  const { isAllUnits, managedUnits, inScope, unitName } = useUnitScope();
  const sectors = useMemo(() => (isAllUnits ? allCompanySectors.filter(s => !s.unit_id || inScope(s.unit_id)) : unitSectors), [isAllUnits, allCompanySectors, unitSectors, inScope]);
  const shifts = isAllUnits ? allCompanyShifts : unitShifts;
  const professionals = isAllUnits && allCompanyProfessionals.length ? allCompanyProfessionals : unitProfessionals;
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({ name: '', status: 'ativo', unit_id: '' });
  // Turnos padrão do setor (company.data.sector_shift_templates)
  const [turns, setTurns] = useState([]);
  // Valores do plantão do setor (company.data.sector_rates), V0.9.1
  const [rates, setRates] = useState({});

  const companyId = user?.data?.company_id || user?.company_id || company?.id || 'cmp_principal';
  const unitId = selectedUnitId || user?.data?.selected_unit_id || 'unit_h1';

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const specialtyOptions = useMemo(() => {
    const set = new Set();
    professionals.forEach(p => { if (p?.specialty?.trim()) set.add(p.specialty.trim()); });
    sectors.forEach(s => { if (s?.specialty?.trim() && s.specialty !== 'Geral') set.add(s.specialty.trim()); });
    return [...set];
  }, [professionals, sectors]);

  const filteredSectors = useMemo(() => {
    const term = searchQuery.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    return sectors.filter(s => {
      if (!term) return true;
      const name = (s.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return name.includes(term);
    }).sort((a, b) => (isAllUnits ? unitName(a.unit_id).localeCompare(unitName(b.unit_id)) : 0) || (a.name || '').localeCompare(b.name || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, searchQuery, isAllUnits]);

  // Por setor: equipe autorizada, plantões e vagas abertas do mês atual.
  const sectorStats = useMemo(() => {
    const activeTeam = professionals.filter(p => String(p.status || 'ativo').toLowerCase() !== 'inativo');
    const stats = {};
    sectors.forEach(sector => {
      const monthShifts = shifts.filter(sh => String(sh.sector_id) === String(sector.id) && String(sh.date || '').startsWith(monthPrefix) && !String(sh.status || '').toLowerCase().includes('cancel'));
      stats[sector.id] = {
        team: activeTeam.filter(p => isProfessionalAuthorizedForSector(p, sector.id)).length,
        shifts: monthShifts.length,
        vacancies: monthShifts.filter(s => isShiftVacant(s) && !isIdleExtraSlot(s)).length
      };
    });
    return stats;
  }, [sectors, shifts, professionals, monthPrefix]);

  const activeCount = sectors.filter(s => s.active !== false).length;

  const handleOpenModal = (sector = null) => {
    setEditingSector(sector);
    setFormData({ name: sector?.name || '', status: sector?.active === false ? 'inativo' : 'ativo', unit_id: String(sector?.unit_id || (isAllUnits ? '' : unitId)) });
    const saved = sector ? getSectorTemplates(company, sector.id) : [];
    setTurns(saved.map(t => ({ ...newTurn(), ...t })));
    const savedRates = sector ? getSectorRates(company, sector.id) : {};
    const form = Object.fromEntries(Object.entries(savedRates).map(([k, v]) => [k, String(v)]));
    // Tabela da V0.9.1 tinha um valor só de meio expediente: vira o valor das quatro colunas.
    if (form.meio !== undefined) RATE_COLUMNS.forEach(c => { if (form[`meio_${c.key}`] === undefined) form[`meio_${c.key}`] = form.meio; });
    delete form.meio;
    setRates(form);
    setModalOpen(true);
  };

  const updateTurn = (key, field, value) => setTurns(list => list.map(t => (t.key === key ? { ...t, [field]: value } : t)));

  const addTurn = () => setTurns(list => {
    const last = list[list.length - 1];
    // O segundo turno já sugere a noite (19–07) com a mesma especialidade.
    const next = newTurn(last?.specialty || editingSector?.specialty || specialtyOptions[0] || '');
    if (last && last.start_time === '07:00' && last.end_time === '19:00') { next.start_time = '19:00'; next.end_time = '07:00'; }
    return [...list, next];
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('O nome do setor é obrigatório.');
      return;
    }
    if (!formData.unit_id) {
      alert('Escolha a unidade (hospital) do setor.');
      return;
    }
    if (turns.some(t => (parseInt(t.extra_quantity, 10) || 0) > 0 && !(t.extra_weekdays || []).length)) {
      alert('Escolha em quais dias da semana entram as vagas extras (ou deixe as extras em 0).');
      return;
    }
    if (turns.some(t => !String(t.specialty || '').trim())) {
      alert('Escolha a especialidade de cada turno (ou remova o turno).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: companyId,
        unit_id: formData.unit_id,
        name: formData.name.trim(),
        // O banco guarda a situação em "active" (sim/não); não existe coluna "status" em sectors.
        active: formData.status !== 'inativo'
      };

      let sectorId = editingSector?.id;
      if (sectorId) {
        const { error } = await supabase.from('sectors').update(payload).eq('id', sectorId);
        if (error) throw error;
      } else {
        // Mantém compatibilidade com a estrutura de colunas do banco
        const { data, error } = await supabase.from('sectors').insert([{ ...payload, specialty: 'Geral' }]).select('id').single();
        if (error) throw error;
        sectorId = data?.id;
      }

      const before = editingSector ? getSectorTemplates(company, editingSector.id) : [];
      const ratesBefore = editingSector ? getSectorRates(company, editingSector.id) : {};
      const touchesTurns = turns.length || before.length;
      const touchesRates = Object.values(rates).some(v => String(v).trim() !== '') || Object.keys(ratesBefore).length;
      if (sectorId && (touchesTurns || touchesRates)) {
        const { data: row, error: readError } = await supabase.from('companies').select('data').eq('id', company.id).single();
        if (readError) throw readError;
        let nextData = row?.data || {};
        if (touchesTurns) nextData = withSectorTemplates(nextData, sectorId, turns);
        if (touchesRates) nextData = withSectorRates(nextData, sectorId, rates);
        const { error } = await supabase.from('companies').update({ data: nextData }).eq('id', company.id);
        if (error) throw new Error('o setor foi salvo, mas os turnos padrão e os valores não. ' + error.message);
      }

      setModalOpen(false);
      await syncGlobalData();
    } catch (error) {
      alert('Erro ao salvar setor: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Excluir o setor leva junto a escala dele (V0.9.2): antes, os plantões ficavam no sistema sem setor.
  // Com escala publicada ou plantão já feito, o setor só pode ser desativado, para guardar o histórico.
  const handleDelete = async (id, name) => {
    try {
      const { data: rows, error: readError } = await supabase.from('shifts').select('id, date, unit_id, sector_id, professional_id, status').eq('sector_id', id);
      if (readError) throw readError;
      const today = getLocalDateString();
      const list = rows || [];
      const published = list.filter(s => isShiftPublished(s, getPublishedRanges, selectedUnitId)).length;
      const done = list.filter(s => s.professional_id && String(s.date).slice(0, 10) < today).length;
      if (published || done) {
        alert(`O setor "${name}" tem ${published ? `${published} plantão(ões) de escala publicada` : ''}${published && done ? ' e ' : ''}${done ? `${done} plantão(ões) já feito(s)` : ''}.

Para não perder o histórico (Faturamento, Minha Escala, relatórios), desative o setor em vez de excluir: Editar › Situação › Inativo.`);
        return;
      }
      const withProf = list.filter(s => s.professional_id).length;
      if (!confirm(`Excluir o setor "${name}"?${list.length ? `

Também saem os ${list.length} plantão(ões) da escala dele, que ainda não foi publicada${withProf ? ` (${withProf} com profissional)` : ''}.` : ''}

Não dá para desfazer.`)) return;
      if (list.length) {
        const { error: shiftsError } = await supabase.from('shifts').delete().eq('sector_id', id);
        if (shiftsError) throw shiftsError;
      }
      const { error } = await supabase.from('sectors').delete().eq('id', id);
      if (error) throw error;
      const { data: row } = await supabase.from('companies').select('data').eq('id', company.id).single();
      if (row?.data) {
        await supabase.from('companies').update({ data: withSectorRates(withSectorTemplates(row.data, id, []), id, {}) }).eq('id', company.id);
      }
      await syncGlobalData();
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const buildMonth = (sector) => {
    // Visão de uma unidade só: abre a Escala já na unidade do setor.
    if (!isAllUnits && sector.unit_id && String(sector.unit_id) !== String(selectedUnitId)) setUnitScope(String(sector.unit_id));
    try { window.sessionStorage.setItem('scale_open_generator_sector', String(sector.id)); } catch { /* sem sessionStorage: abre a Escala normal */ }
    navigate('/escalas');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 space-y-6 font-sans transition-colors duration-300">

      <PageHero
        title="Setores"
        subtitle={`${activeCount} ${activeCount === 1 ? 'setor ativo' : 'setores ativos'} · cadastre os turnos fixos de cada um para montar o mês num clique.`}
        actions={isManager ? (t => (
          <Button onClick={() => handleOpenModal()} className={`w-full sm:w-auto font-medium text-sm h-10 px-4 rounded-xl gap-2 cursor-pointer shadow-none font-semibold shrink-0 ${t.primary}`}>
            <Plus className="w-4 h-4" /> Novo setor
          </Button>
        )) : undefined}
      />

      {sectors.length > 6 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Buscar setor pelo nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-sm transition-colors"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSectors.length === 0 ? (
          <div className="col-span-full border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl bg-white/50 dark:bg-slate-900/50">
            {sectors.length ? (
              <EmptyState icon={Search} title="Nenhum setor com esse nome" actions={[{ label: 'Limpar busca', onClick: () => setSearchQuery('') }]} />
            ) : (
              <EmptyState icon={Building2} title="Comece pelos setores do hospital"
                text={isManager ? 'Cadastre cada setor (UTI, Emergência, Enfermaria...) com os turnos fixos. Depois, na Escala, o mês inteiro se monta com um clique.' : 'A coordenação ainda não cadastrou os setores desta unidade.'}
                actions={isManager ? [{ label: 'Novo setor', icon: Plus, onClick: () => handleOpenModal() }] : []} />
            )}
          </div>
        ) : (
          filteredSectors.map((sector) => {
            const isInactive = sector.active === false;
            const templates = getSectorTemplates(company, sector.id);
            const sectorRates = getSectorRates(company, sector.id);
            const rateSummary = [['semana_dia', 'Dia'], ['semana_noite', 'Noite'], ['fds_dia', 'FDS dia'], ['fds_noite', 'FDS noite'], ['meio_semana_dia', 'Meio dia'], ['meio_semana_noite', 'Meio noite'], ['meio_fds_dia', 'Meio FDS dia'], ['meio_fds_noite', 'Meio FDS noite'], ['meio', 'Meio']]
              .filter(([key]) => sectorRates[key] !== undefined).map(([key, label]) => `${label} ${formatCurrency(sectorRates[key])}`);
            const st = sectorStats[sector.id] || { team: 0, shifts: 0, vacancies: 0 };

            return (
              <Card key={sector.id} className={`p-5 rounded-3xl border flex flex-col h-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${isInactive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-lg text-slate-900 dark:text-white leading-tight">{sector.name}</h3>
                    {isAllUnits && <span className="mt-1 inline-block rounded-md bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">{unitName(sector.unit_id)}</span>}
                  </div>
                  {isInactive && <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">Inativo</span>}
                </div>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <dt className="sr-only">Turnos padrão</dt>
                      {templates.length ? (
                        <dd className="text-slate-700 dark:text-slate-200">
                          <span className="tabular-nums">{templateSummary(templates)}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">{vacanciesPerDay(templates)} vagas por dia</span>
                        </dd>
                      ) : (
                        <dd className="text-slate-500 dark:text-slate-400">Sem turnos padrão{isManager && <> · <button type="button" onClick={() => handleOpenModal(sector)} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">cadastrar</button></>}</dd>
                      )}
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex items-start gap-2.5">
                      <DollarSign className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                      <dt className="sr-only">Valores do plantão</dt>
                      {rateSummary.length
                        ? <dd className="text-slate-700 dark:text-slate-200 text-xs leading-relaxed tabular-nums">{rateSummary.join(' · ')}</dd>
                        : <dd className="text-slate-500 dark:text-slate-400">Sem tabela de valores · <button type="button" onClick={() => handleOpenModal(sector)} className="text-sky-700 dark:text-sky-300 font-medium hover:underline cursor-pointer">cadastrar</button></dd>}
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Users className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    <dd className="text-slate-700 dark:text-slate-200"><span className="tabular-nums">{st.team}</span> {st.team === 1 ? 'profissional autorizado' : 'profissionais autorizados'}</dd>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    <dd className="text-slate-700 dark:text-slate-200">
                      {st.shifts === 0
                        ? <span className="text-slate-500 dark:text-slate-400">Nenhum plantão em {MONTHS[now.getMonth()]}</span>
                        : <><span className="tabular-nums">{st.shifts}</span> plantões em {MONTHS[now.getMonth()]}{st.vacancies > 0
                            ? <> · <span className="font-medium text-amber-700 dark:text-amber-400 tabular-nums">{st.vacancies} {st.vacancies === 1 ? 'vaga aberta' : 'vagas abertas'}</span></>
                            : <> · completo</>}</>}
                    </dd>
                  </div>
                </dl>

                {isManager && (
                  <div className="mt-auto pt-5 flex items-center gap-2">
                    {!isInactive && (
                      <Button onClick={() => buildMonth(sector)} variant="outline" className="h-9 text-xs font-semibold rounded-xl px-3 gap-1.5 cursor-pointer">
                        <CalendarPlus className="w-3.5 h-3.5" /> Montar mês
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => handleOpenModal(sector)} className="h-9 text-xs font-semibold rounded-xl px-3 gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200">
                      <Edit className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(sector.id, sector.name)} aria-label={`Excluir ${sector.name}`} className="ml-auto h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-2xl z-[9999] p-5 sm:p-6 rounded-3xl">
          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <DialogTitle className="text-lg font-semibold">{editingSector ? 'Editar setor' : 'Novo setor'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 py-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome do setor *</Label>
                <Input
                  autoFocus={!editingSector}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
              {managedUnits.length > 1 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Unidade (hospital) *</Label>
                  {editingSector ? (
                    <p className="h-11 flex items-center px-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm">{unitName(formData.unit_id)}</p>
                  ) : (
                    <Select value={formData.unit_id} onValueChange={v => setFormData({ ...formData, unit_id: v })}>
                      <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"><SelectValue placeholder="Escolha a unidade" /></SelectTrigger>
                      <SelectContent className="z-[99999]">
                        {managedUnits.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Situação</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[99999]">
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Turnos padrão</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Os horários fixos de todo dia. Na Escala, “Montar turnos do mês” já abre com eles. <b>Vagas extras</b> entram só nos dias da semana escolhidos, para encaixar alguém a mais; elas continuam na escala depois de publicar, para você encaixar alguém quando precisar, e vazias não contam como vaga em aberto nem vão para o Mural.</p>
              </div>

              {turns.map(turn => (
                <div key={turn.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_6rem_6rem_4.5rem_auto] items-end gap-2 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                  <div className="col-span-2 sm:col-span-1 space-y-1 min-w-0">
                    <Label className="text-[11px] text-slate-500">Especialidade</Label>
                    <SpecialtyPicker value={turn.specialty} options={specialtyOptions} onChange={v => updateTurn(turn.key, 'specialty', v)} triggerClassName="h-9 text-xs bg-white dark:bg-slate-950" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Entrada</Label>
                    <Input type="time" value={turn.start_time} onChange={e => updateTurn(turn.key, 'start_time', e.target.value)} className="h-9 text-xs bg-white dark:bg-slate-950" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Saída</Label>
                    <Input type="time" value={turn.end_time} onChange={e => updateTurn(turn.key, 'end_time', e.target.value)} className="h-9 text-xs bg-white dark:bg-slate-950" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Vagas</Label>
                    <Input type="number" min="1" max="50" value={turn.quantity} onChange={e => updateTurn(turn.key, 'quantity', e.target.value)} className="h-9 text-xs text-center bg-white dark:bg-slate-950" required />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setTurns(list => list.filter(t => t.key !== turn.key))} aria-label="Remover turno" className="h-9 w-9 p-0 text-slate-400 hover:text-rose-600 rounded-xl cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="col-span-2 sm:col-span-5 flex flex-wrap items-center gap-2 pt-1">
                    <Label className="text-[11px] text-slate-500">Vagas extras</Label>
                    <Input type="number" min="0" max="50" value={turn.extra_quantity ?? 0} onChange={e => updateTurn(turn.key, 'extra_quantity', e.target.value)} aria-label="Vagas extras" className="h-8 w-16 text-xs text-center bg-white dark:bg-slate-950" />
                    {(parseInt(turn.extra_quantity, 10) || 0) > 0 && (
                      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Dias das vagas extras">
                        <span className="text-[11px] text-slate-500 mr-0.5">nos dias</span>
                        {[1, 2, 3, 4, 5, 6, 0].map(day => {
                          const on = (turn.extra_weekdays || []).includes(day);
                          return (
                            <button key={day} type="button" aria-pressed={on}
                              onClick={() => updateTurn(turn.key, 'extra_weekdays', on ? turn.extra_weekdays.filter(d => d !== day) : [...(turn.extra_weekdays || []), day])}
                              className={`h-7 min-w-9 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                              {WEEKDAY_INITIALS[day]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addTurn} className="h-9 text-xs font-semibold rounded-xl px-3 gap-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> {turns.length ? 'Adicionar turno' : 'Cadastrar turnos'}
              </Button>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Valores do plantão</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Quanto se paga por plantão neste setor, para toda a equipe. Quem tem valor próprio no cadastro (Corpo Clínico) recebe o dele. Noturno é o plantão que começa a partir das 18h; fim de semana, sábado e domingo; meio expediente, o plantão de até 6 horas.</p>
              </div>
              {[{ prefix: '', title: 'Plantão inteiro' }, { prefix: 'meio_', title: 'Meio expediente (até 6 h)' }].map(row => (
                <div key={row.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{row.title}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {RATE_COLUMNS.map(col => {
                      const key = `${row.prefix}${col.key}`;
                      return (
                        <label key={key} className="space-y-1">
                          <span className="block text-[11px] text-slate-500">{col.label}</span>
                          <Input type="number" min="0" step="0.01" inputMode="decimal" value={rates[key] ?? ''} placeholder="R$ —"
                            onChange={e => setRates(r => ({ ...r, [key]: e.target.value }))}
                            className="h-9 text-right text-sm bg-white dark:bg-slate-950" />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Deixe em branco o que não se aplica. Sem valor de meio expediente, o plantão curto segue a tabela do plantão inteiro.</p>
            </div>

            <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end border-t border-slate-100 dark:border-slate-800 gap-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="w-full sm:w-auto h-11 text-xs font-semibold rounded-xl px-6 cursor-pointer">
                <X className="w-4 h-4 mr-1.5" /> Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto h-11 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs px-8 rounded-xl shadow-sm cursor-pointer">
                <Save className="w-4 h-4 mr-1.5" /> {submitting ? 'Salvando…' : 'Salvar setor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
