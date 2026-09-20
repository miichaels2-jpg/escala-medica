import React from 'react';
import { Card } from '@/components/ui/card';
import { CalendarClock, Users, BarChart3, BellRing, MapPinCheck, CheckCircle2, MessageSquareText } from 'lucide-react';

const quickStats = [
  { label: 'Plantões', value: '12', tone: 'sky', bgClass: 'bg-sky-50' },
  { label: 'Confirmados', value: '10', tone: 'emerald', bgClass: 'bg-emerald-50' },
  { label: 'Pendentes', value: '2', tone: 'amber', bgClass: 'bg-amber-50' },
];

const nextShift = [
  { day: 'Seg', time: '07:00 - 19:00', sector: 'Cardiologia', status: 'Confirmado' },
  { day: 'Qua', time: '19:00 - 07:00', sector: 'UTI', status: 'Confirmado' },
  { day: 'Sex', time: '08:00 - 16:00', sector: 'Clínica Médica', status: 'Pendente' },
];

export default function MobilePreview() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4">
      <div className="mx-auto max-w-sm">
        <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_25px_70px_rgba(15,23,42,0.12)] overflow-hidden">
          <div className="bg-sky-600 px-5 pb-6 pt-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100">ScaleMedic</div>
                <div className="mt-2 text-2xl font-black">Olá, Michael</div>
              </div>
              <div className="rounded-2xl bg-white/15 p-2">
                <BellRing className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm backdrop-blur">
              <MapPinCheck className="h-4 w-4" />
              Hospital Santa Clara
            </div>
          </div>

          <div className="px-4 pb-4 pt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {quickStats.map((item) => (
                <div key={item.label} className={`rounded-2xl border border-slate-100 p-3 ${item.bgClass}`}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-xl font-black text-slate-900">{item.value}</div>
                </div>
              ))}
            </div>

            <Card className="border-slate-200 p-3 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CalendarClock className="h-4 w-4 text-sky-600" />
                  Próximos turnos
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Agosto</span>
              </div>
              <div className="mt-3 space-y-2">
                {nextShift.map((shift) => (
                  <div key={shift.day} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">{shift.day}</div>
                      <div className="text-sm font-medium text-slate-800">{shift.time}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{shift.sector}</div>
                      <div className="mt-1 text-[10px] font-semibold text-emerald-600">{shift.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Card className="border-slate-200 p-3 shadow-none">
                <div className="flex items-center gap-2 text-sky-700">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Equipe</span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">18</div>
                <div className="text-[10px] text-slate-500">Profissionais ativos</div>
              </Card>
              <Card className="border-slate-200 p-3 shadow-none">
                <div className="flex items-center gap-2 text-emerald-700">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Faturamento</span>
                </div>
                <div className="mt-3 text-2xl font-black text-slate-900">R$ 18k</div>
                <div className="text-[10px] text-slate-500">mês em curso</div>
              </Card>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                <CheckCircle2 className="h-4 w-4" />
                Check-in no local
              </div>
              <div className="mt-2 text-xs text-slate-600">Confirmação de presença e localização dentro da unidade habilitada.</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MessageSquareText className="h-4 w-4 text-violet-600" />
                Mensagens e alertas
              </div>
              <div className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
                Plantão confirmado para o setor de UTI.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}