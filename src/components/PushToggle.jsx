import { useEffect, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react';
import { useAppData } from '@/lib/useAppData';
import { disablePush, enablePush, getPushState } from '@/lib/push';

// Ativar/desativar avisos no celular (chegam mesmo com o app fechado).
export default function PushToggle() {
  const { user, currentProfessional } = useAppData();
  const [state, setState] = useState('carregando');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { getPushState().then(setState); }, []);

  if (state === 'carregando' || state === 'indisponivel') return null;

  const professionalId = currentProfessional?.id && currentProfessional.id !== 'temp_user_id' ? currentProfessional.id : '';

  const toggle = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (state === 'ativo') {
        await disablePush();
      } else {
        await enablePush({ userId: user?.id, professionalId });
        setMessage('Pronto! Os avisos vão chegar neste aparelho.');
      }
    } catch (error) {
      setMessage(error?.message || 'Não foi possível alterar os avisos.');
    } finally {
      setState(await getPushState());
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3 text-xs">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${state === 'ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          {state === 'instalar' ? <Smartphone className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200">
          {state === 'ativo' && 'Avisos no celular ativados.'}
          {state === 'desativado' && 'Receba os avisos no celular, mesmo com o app fechado.'}
          {state === 'bloqueado' && 'Os avisos estão bloqueados neste navegador. Libere nas configurações do site.'}
          {state === 'instalar' && 'No iPhone, instale o app na tela de início para receber avisos.'}
        </span>
        {(state === 'ativo' || state === 'desativado') && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer disabled:opacity-60 ${state === 'ativo' ? 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800' : 'bg-sky-600 text-white hover:bg-sky-500'}`}
          >
            {busy ? '…' : state === 'ativo' ? 'Desativar' : 'Ativar'}
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-slate-500 dark:text-slate-400" role="status">{message}</p>}
    </div>
  );
}
