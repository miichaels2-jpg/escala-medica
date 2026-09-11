import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAppData } from '@/lib/useAppData';
import { Button } from '@/components/ui/button';
import { Calendar, Repeat, DollarSign, User, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SwapRequestDialog from '@/components/shifts/SwapRequestDialog';
import NotificationBell from '@/components/NotificationBell';
import { getShiftInterval } from '@/lib/shiftUtils';

const shiftTypeStyle = {
  diurno: 'bg-sky-50 text-sky-700',
  noturno: 'bg-purple-50 text-purple-700',
  intermediario: 'bg-amber-50 text-amber-700',
};

function fmtFull(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', weekday: 'long' });
}

export default function MinhaEscala() {
  const { user, company, loading: appLoading } = useAppData();
  const [myShifts, setMyShifts] = useState([]);
  const [companyShifts, setCompanyShifts] = useState([]);
  const [myProfessional, setMyProfessional] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [swapShift, setSwapShift] = useState(null);
  const [tab, setTab] = useState('escala');

  // Valores primitivos para evitar loop infinito
  const userId = user?.id;
  const userEmail = user?.email;
  const userFullName = user?.full_name;
  const companyId = user?.data?.company_id || company?.id || 'cmp_principal';
  const unitId = user?.data?.selected_unit_id || company?.selected_unit_id || company?.units?.[0]?.id || 'unit_h1';
  const isManager = user?.role === 'admin' || user?.data?.app_role === 'manager' || user?.data?.app_role === 'gestor';

  useEffect(() => {
    if (appLoading || !userId) return;

    let isMounted = true;
    (async () => {
      try {
        const filterQuery = companyId ? { company_id: companyId } : {};
        const [profs, shifts] = await Promise.all([
          base44.entities.Professional.filter(filterQuery, '-created_date', 200),
          base44.entities.Shift.filter(filterQuery, 'date', 500)
        ]);

        if (!isMounted) return;

        const me = profs.find((p) => p.user_id === userId || (p.email && p.email === userEmail));
        setMyProfessional(me || null);
        setProfessionals(profs || []);
        setCompanyShifts(shifts || []);

        const profId = me?.id;
        const mine = (shifts || [])
          .filter((s) => s.professional_id === profId || (!profId && s.professional_name === userFullName))
          .filter((s) => s.status === 'confirmado' || s.status === 'pendente')
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        setMyShifts(mine);
      } catch (e) {
        console.error('Erro ao carregar escala do profissional:', e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [appLoading, userId, userEmail, userFullName, companyId, unitId]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return myShifts.filter((s) => {
      const interval = getShiftInterval(s);
      return (interval?.end || new Date(s.date + 'T23:59:59')) >= todayStart;
    });
  }, [myShifts]);

  const next = upcoming[0];

  const availableOpenShifts = useMemo(() => {
    if (!myProfessional) return [];
    return companyShifts.filter((shift) => {
      if (shift.status !== 'vago' || shift.company_id !== companyId) return false;
      const target = shift.sector_name || shift.sector_id || '';
      const specialty = (myProfessional.specialty || '').toLowerCase();
      const category = (myProfessional.category || '').toLowerCase();
      const targetLower = target.toLowerCase();

      const matchesRole =
        !specialty ||
        specialty.includes(targetLower) ||
        targetLower.includes(specialty) ||
        category.includes(targetLower) ||
        targetLower.includes(category);

      if (!matchesRole) return false;

      const alreadyAssigned = companyShifts.some((existingShift) => {
        if (!existingShift || existingShift.professional_id !== myProfessional.id) return false;
        if (existingShift.status === 'cancelado') return false;
        return existingShift.date === shift.date;
      });

      return !alreadyAssigned;
    });
  }, [companyShifts, myProfessional, companyId]);

  const totalHours = useMemo(() => {
    return myShifts.reduce((s, sh) => s + (sh.duration_hours || 12), 0);
  }, [myShifts]);

  const handleAcceptOpenShift = async (shiftId) => {
    try {
      if (!myProfessional) {
        alert('Você precisa estar vinculado a um profissional para aceitar uma vaga.');
        return;
      }

      await base44.entities.Shift.update(shiftId, {
        professional_id: myProfessional.id,
        professional_name: myProfessional.name,
        status: 'confirmado'
      });

      const updated = await base44.entities.Shift.filter({ company_id: companyId }, 'date', 500);
      setCompanyShifts(updated);
      const mine = updated
        .filter((s) => s.professional_id === myProfessional.id || (!myProfessional && s.professional_name === userFullName))
        .filter((s) => s.status === 'confirmado' || s.status === 'pendente')
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setMyShifts(mine);
    } catch (e) {
      alert('Não foi possível aceitar a vaga no momento.');
    }
  };

  const handleConfirmShift = async (shiftId) => {
    try {
      await base44.entities.Shift.update(shiftId, { status: 'confirmado' });
      const updated = await base44.entities.Shift.filter({ company_id: companyId }, 'date', 500);
      const mine = updated
        .filter((s) => s.professional_id === myProfessional?.id || (!myProfessional && s.professional_name === userFullName))
        .filter((s) => s.status === 'confirmado' || s.status === 'pendente')
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      setMyShifts(mine);
    } catch (e) {
      alert('Não foi possível confirmar o plantão agora.');
    }
  };

  const handleCheckIn = async (shift) => {
    if (!navigator.geolocation) {
      alert('Este navegador não suporta geolocalização.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          if (!position?.coords?.latitude) {
            alert('Não foi possível confirmar a localização.');
            return;
          }
          await base44.entities.Shift.update(shift.id, {
            checked_in: true,
            location_verified: true,
            checkin_lat: position.coords.latitude,
            checkin_lng: position.coords.longitude,
            status: 'confirmado'
          });
          const updated = await base44.entities.Shift.filter({ company_id: companyId }, 'date', 500);
          const mine = updated
            .filter((s) => s.professional_id === myProfessional?.id || (!myProfessional && s.professional_name === userFullName))
            .filter((s) => s.status === 'confirmado' || s.status === 'pendente')
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
          setMyShifts(mine);
        } catch (e) {
          alert('Não foi possível registrar o check-in.');
        }
      },
      () => {
        alert('Para o check-in funcionar, permita o acesso à localização.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="min-h-full bg-slate-100 flex justify-center">
      <div className="w-full max-w-5xl bg-slate-50 min-h-full flex flex-col">
        {/* Header Superior */}
        <div className="bg-white px-5 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10">
          <div>
            <div className="text-xs text-slate-400">Olá,</div>
            <div className="text-base font-bold text-slate-800">{myProfessional?.name || userFullName || userEmail}</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sm font-semibold text-sky-700">
              {(myProfessional?.name || userFullName || '?').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="mx-auto flex-1 w-full max-w-4xl p-4 space-y-4 overflow-y-auto pb-24 md:p-8">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-sky-600">Sua agenda</div>
              <div className="text-sm font-semibold text-slate-700">{myProfessional?.name || userFullName || 'Profissional'}</div>
            </div>
            {!isManager && (
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                Perfil profissional
              </span>
            )}
          </div>

          {/* Destaque do Próximo Plantão */}
          {next ? (
            <div className="bg-sky-600 text-white p-5 rounded-2xl shadow-sm">
              <div className="text-xs opacity-80 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Próximo Plantão
              </div>
              <div className="text-lg font-bold mt-1">{fmtFull(next.date)}</div>
              <div className="text-sm mt-0.5">{next.start_time} às {next.end_time}</div>
              <div className="text-xs mt-2 opacity-90 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {company?.name || 'Hospital'} · {next.sector_name || '—'}
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center text-sm text-slate-400">
              Nenhum plantão futuro atribuído a você.
            </div>
          )}

          {tab === 'escala' && (
            <>
              <div className="font-semibold text-slate-700 text-sm">Meus Próximos Plantões</div>
              {availableOpenShifts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-amber-600">Vagas abertas para você</div>
                  {availableOpenShifts.map((shift) => (
                    <div key={shift.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700">Vaga disponível</div>
                          <div className="mt-1 text-sm font-bold text-slate-800">{shift.sector_name || 'Especialidade'} · {fmtFull(shift.date)}</div>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                          {shift.shift_type}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600">{shift.start_time} às {shift.end_time}</div>
                      <Button size="sm" className="w-full text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => handleAcceptOpenShift(shift.id)}>
                        Aceitar vaga
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {upcoming.length === 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 text-center text-sm text-slate-400">
                  Sem plantões agendados.
                </div>
              )}

              {upcoming.map((s) => (
                <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-600 uppercase">{fmtFull(s.date)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${shiftTypeStyle[s.shift_type] || 'bg-slate-100 text-slate-600'}`}>
                      {s.duration_hours || 12}h
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-800">{s.start_time} às {s.end_time} · {s.sector_name || '—'}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {company?.name || 'Hospital'}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {s.status === 'confirmado' || s.checked_in ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {s.checked_in ? 'Check-in validado' : 'Confirmado'}
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5" /> Aguardando confirmação
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => setSwapShift(s)}>
                      Solicitar Troca
                    </Button>
                    {s.status !== 'confirmado' ? (
                      <Button size="sm" className="flex-1 text-xs h-8 bg-sky-600 hover:bg-sky-700 text-white" onClick={() => handleConfirmShift(s.id)}>
                        Confirmar
                      </Button>
                    ) : (
                      <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleCheckIn(s)}>
                        {s.checked_in ? 'Confirmado' : 'Check-in'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'trocas' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
              <Repeat className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhuma solicitação de troca no momento.</p>
            </div>
          )}

          {tab === 'extrato' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Horas no mês</span>
                <span className="text-lg font-bold text-slate-800">{totalHours}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Plantões confirmados</span>
                <span className="text-lg font-bold text-emerald-600">
                  {myShifts.filter((s) => s.status === 'confirmado').length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Pendentes</span>
                <span className="text-lg font-bold text-amber-600">
                  {myShifts.filter((s) => s.status === 'pendente').length}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                Valores de repasse são gerados no módulo de Faturamento pelo gestor.
              </div>
            </div>
          )}

          {tab === 'perfil' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-xl font-bold text-sky-700 mx-auto">
                  {(myProfessional?.name || userFullName || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="font-semibold text-slate-800 mt-2">{myProfessional?.name || userFullName}</div>
                <div className="text-xs text-slate-500">{userEmail}</div>
              </div>
              {myProfessional && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-sm">
                  {myProfessional.specialty && (
                    <div className="text-slate-600">Especialidade: <span className="font-medium">{myProfessional.specialty}</span></div>
                  )}
                  {myProfessional.document && (
                    <div className="text-slate-600">Documento: <span className="font-medium">{myProfessional.document}</span></div>
                  )}
                  {myProfessional.phone && (
                    <div className="text-slate-600">Telefone: <span className="font-medium">{myProfessional.phone}</span></div>
                  )}
                </div>
              )}
              <Link to="/configuracoes">
                <Button variant="outline" size="sm" className="w-full mt-2">Editar perfil</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Barra de Navegação Inferior */}
        <div className="bg-white border-t border-slate-200 flex justify-around items-center h-16 sticky bottom-0">
          {[
            { key: 'escala', icon: Calendar, label: 'Minha Escala' },
            { key: 'trocas', icon: Repeat, label: 'Trocas' },
            { key: 'extrato', icon: DollarSign, label: 'Extrato/Horas' },
            { key: 'perfil', icon: User, label: 'Perfil' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex flex-col items-center text-[10px] gap-0.5 ${tab === item.key ? 'text-sky-600 font-bold' : 'text-slate-400'}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SwapRequestDialog
        open={!!swapShift}
        onClose={() => setSwapShift(null)}
        onDone={() => setSwapShift(null)}
        shift={swapShift}
        professionals={professionals}
        myProfessional={myProfessional}
        companyId={companyId}
        unitId={unitId}
      />
    </div>
  );
}