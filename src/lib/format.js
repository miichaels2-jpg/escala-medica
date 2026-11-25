// Formatação usada em todas as telas: texto para comparar, datas "AAAA-MM-DD" e valores em R$.
// Antes cada tela tinha a sua cópia (até 6 da mesma função), e algumas tinham diferenças.
import { safeFinancialNumber } from './financialCalculations.js';

// Sem acento, minúsculo e sem espaços nas pontas: "Clínica Médica " → "clinica medica".
export function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Data de hoje (ou de d) como "AAAA-MM-DD" no dia local, não em UTC.
export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "2026-11-25" ou "2026-11-25T10:00" → "25/11/2026"; vazio vira `empty` ("" ou "—").
export function formatDateBR(value, empty = '') {
  if (!value) return empty;
  const clean = String(value).trim().split('T')[0];
  const parts = clean.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
}

// Aceita número ou texto ("R$ 1.234,56", "12.500", "1200,5").
export function safeNumber(value, fallback = 0) {
  return safeFinancialNumber(value, fallback);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(value));
}

// Mesma data, com "—" quando não há (impressos, tabelas de valores).
export const formatDateOrDash = value => formatDateBR(value, '—');
