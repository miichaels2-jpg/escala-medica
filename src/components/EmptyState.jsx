import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// Tela vazia que orienta (V0.8.10): em vez de "nenhum registro", diz por que está vazio e oferece
// o próximo passo. actions: [{ label, icon, onClick } | { label, icon, to }]; a primeira é a principal.
export default function EmptyState({ icon: Icon, title, text, actions = [], compact = false, className = '' }) {
  return (
    <div className={`text-center ${compact ? 'py-6 px-4' : 'py-12 px-6'} ${className}`}>
      {Icon && (
        <div className={`mx-auto mb-3 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}>
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden="true" />
        </div>
      )}
      <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{text}</p>}
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {actions.map(({ label, icon: ActionIcon, onClick, to }, index) => {
            const content = <>{ActionIcon && <ActionIcon className="h-4 w-4 mr-1.5" aria-hidden="true" />}{label}</>;
            const variant = index === 0 ? 'default' : 'outline';
            const cls = index === 0 ? 'bg-sky-600 hover:bg-sky-500 text-white' : '';
            return to
              ? <Button key={label} asChild variant={variant} size="sm" className={cls}><Link to={to}>{content}</Link></Button>
              : <Button key={label} type="button" variant={variant} size="sm" className={cls} onClick={onClick}>{content}</Button>;
          })}
        </div>
      )}
    </div>
  );
}
