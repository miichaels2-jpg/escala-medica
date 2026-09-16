// Adicione esta importação no topo do seu AppLayout.jsx / App.jsx
import { AppDataProvider } from '@/lib/useAppData';

export default function AppLayout({ children }) {
  return (
    // Adicione o Provider envolvendo o layout todo
    <AppDataProvider>
      <div className="layout-do-seu-sistema">
         {/* ... resto do seu código ... */}
         {children}
      </div>
    </AppDataProvider>
  );
}