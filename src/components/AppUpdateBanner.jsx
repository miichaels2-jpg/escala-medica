import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '@/lib/appUpdate';

// Faixa "Versão nova disponível" (V0.9.6): aparece quando o app volta da memória e já saiu outra versão.
export default function AppUpdateBanner() {
  const { available, reload } = useAppUpdate();
  if (!available) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[10000] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 shadow-lg text-sm">
        <span>Saiu uma versão nova do ScaleMedic.</span>
        <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>
    </div>
  );
}
