// Nota fiscal do profissional PJ: regras sem banco (testáveis).
// Uma nota por unidade + profissional + mês; status enviada → aceita ou devolvida.

export const INVOICE_BUCKET = 'notas-fiscais';
export const INVOICE_MAX_BYTES = 10 * 1024 * 1024;
export const INVOICE_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export const INVOICE_STATUS = {
  falta: { label: 'Falta enviar', tone: 'amber' },
  enviada: { label: 'Enviada, aguardando conferência', short: 'Enviada', tone: 'sky' },
  aceita: { label: 'Aceita', short: 'Aceita', tone: 'emerald' },
  devolvida: { label: 'Devolvida para correção', short: 'Devolvida', tone: 'rose' }
};

export function isPjProfessional(professional) {
  const receipt = professional?.data?.receipt_type || professional?.receipt_type || '';
  return String(receipt).toLowerCase() === 'pj';
}

// Devolve a mensagem de erro (em português) ou '' quando o arquivo serve.
export function validateInvoiceFile(file) {
  if (!file) return 'Escolha o arquivo da nota.';
  if (!INVOICE_TYPES[file.type]) return 'A nota precisa ser PDF, JPG ou PNG.';
  if (file.size > INVOICE_MAX_BYTES) return 'O arquivo passa de 10 MB. Envie um PDF menor ou uma foto mais leve.';
  if (!file.size) return 'O arquivo está vazio.';
  return '';
}

// <empresa>/<profissional>/<AAAA-MM>/<unidade>-<instante>.<ext> (as regras do banco leem as 2 primeiras pastas).
export function invoicePath({ companyId, professionalId, month, unitId, type, at = Date.now() }) {
  const safe = value => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
  return `${safe(companyId)}/${safe(professionalId)}/${safe(month)}/${safe(unitId)}-${at}.${INVOICE_TYPES[type] || 'pdf'}`;
}

export function invoiceKey(unitId, professionalId, month) {
  return `${unitId}|${professionalId}|${month}`;
}

// Situação da nota para mostrar na tela (sem nota = "falta").
export function invoiceState(invoice) {
  return invoice?.status && INVOICE_STATUS[invoice.status] ? invoice.status : 'falta';
}

// Pagamento de PJ sem nota aceita pede confirmação antes de marcar como pago.
export function paymentNeedsInvoice(professional, invoice) {
  return isPjProfessional(professional) && invoiceState(invoice) !== 'aceita';
}
