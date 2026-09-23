import React, { useMemo } from 'react';
import { useAppData } from '@/lib/useAppData';
import { Lock, FileWarning, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function ContractGuard({ children }) {
  const { company, loading } = useAppData();
  const { logout } = useAuth();

  const isBlocked = useMemo(() => {
    if (loading || !company?.data?.contract_end) return false;
    const endDate = new Date(company.data.contract_end + 'T23:59:59');
    const now = new Date();
    // Se o momento atual é MAIOR que o fim do dia final do contrato, bloqueia!
    return now > endDate;
  }, [company, loading]);

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-rose-600/20 blur-[80px] pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-rose-950/50 rounded-2xl border border-rose-900/50 flex items-center justify-center mb-6 shadow-inner">
              <Lock className="w-10 h-10 text-rose-500" />
            </div>

            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
              Acesso Suspenso
            </h1>
            
            <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 text-sm p-4 rounded-2xl mb-6">
              <p className="flex items-start gap-2 text-left">
                <FileWarning className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <span>O contrato de prestação de serviços tecnológicos entre a matriz <b>{company?.name || 'sua empresa'}</b> e a ScaleMedic encontra-se expirado.</span>
              </p>
            </div>

            <p className="text-sm text-slate-400 mb-8 px-4">
              Por questões contratuais, todas as unidades geridas por este núcleo foram bloqueadas temporariamente. Entre em contato com a equipe ScaleMedic para realizar a regularização e o reestabelecimento imediato do sistema.
            </p>

            <div className="flex flex-col w-full gap-3">
              <Button 
                onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black text-sm h-12 rounded-xl shadow-lg cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 mr-2" /> Falar com o Financeiro
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => logout(true)}
                className="w-full text-slate-500 hover:text-white hover:bg-slate-800 text-xs font-bold h-10 rounded-xl cursor-pointer"
              >
                Sair da Conta
              </Button>
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-[10px] font-bold tracking-widest text-slate-600 uppercase">
          ScaleMedic Enterprise • Security Module
        </p>
      </div>
    );
  }

  return children;
}