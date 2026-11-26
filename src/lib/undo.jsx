// "Desfazer" por alguns segundos depois de uma ação que tira alguém da escala
// ou apaga um plantão. A ação já foi feita; desfazer grava o estado anterior de volta.
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

export const UNDO_SECONDS = 10;

export function offerUndo({ title, description, onUndo }) {
  let undone = false;
  const handle = toast({
    title,
    description: description || `Você tem ${UNDO_SECONDS} segundos para desfazer.`,
    duration: UNDO_SECONDS * 1000,
    action: (
      <ToastAction
        altText="Desfazer"
        className="font-semibold"
        onClick={async () => {
          if (undone) return;
          undone = true;
          handle.dismiss();
          try {
            await onUndo();
            toast({ title: 'Desfeito', description: 'Tudo voltou como estava.', duration: 3000 });
          } catch (error) {
            toast({ variant: 'destructive', title: 'Não foi possível desfazer', description: error?.message || 'Tente de novo pela tela de Escalas.', duration: 6000 });
          }
        }}
      >
        Desfazer
      </ToastAction>
    )
  });
  return handle;
}
