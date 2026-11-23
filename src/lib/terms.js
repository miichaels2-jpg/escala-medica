// Versão vigente dos Termos de Uso e da Política de Privacidade (LGPD).
// Ao mudar o texto de src/pages/TermosDeUso.jsx de forma relevante, suba este número:
// no próximo login, cada pessoa aceita de novo e o banco grava a nova versão (accept_terms).
export const TERMS_VERSION = '1';

// Quem aceitou antes de existir o número de versão aceitou a versão 1.
export function needsTermsAcceptance(userData) {
  if (!userData?.lgpd_accepted) return true;
  return String(userData.lgpd_terms_version || '1') !== TERMS_VERSION;
}
