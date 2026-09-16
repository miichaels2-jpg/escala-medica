import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppDataProvider } from '@/lib/AppDataProvider';

// Páginas
import Escalas from '@/pages/Escalas';
import Trocas from '@/pages/Trocas';
import Faturamento from '@/pages/Faturamento';
import CorpoClinico from '@/pages/CorpoClinico';
import MinhaEscala from '@/pages/MinhaEscala';

export default function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/escalas" element={<Escalas />} />
          <Route path="/trocas" element={<Trocas />} />
          <Route path="/faturamento" element={<Faturamento />} />
          <Route path="/corpo-clinico" element={<CorpoClinico />} />
          <Route path="/minha-escala" element={<MinhaEscala />} />
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}