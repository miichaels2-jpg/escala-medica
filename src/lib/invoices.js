// Nota fiscal do profissional PJ: banco (tabela invoices) e arquivos (Storage "notas-fiscais").
// Regras de acesso no banco (migração 20261126120000): o profissional vê e envia as suas;
// gestão e faturamento da empresa veem todas, aceitam ou devolvem.
import { supabase } from '@/lib/supabase';
import { INVOICE_BUCKET, invoiceKey, invoicePath, validateInvoiceFile } from '@/lib/invoiceRules';

const COLUMNS = 'id,company_id,unit_id,professional_id,month,file_path,file_name,file_size,status,review_note,uploaded_by,reviewed_by,reviewed_at,created_date,updated_date';

// Notas de um mês (ou de um profissional), num mapa unidade|profissional|mês → nota.
export async function fetchInvoices({ companyId, month, professionalId }) {
  let query = supabase.from('invoices').select(COLUMNS).eq('company_id', String(companyId));
  if (month) query = query.eq('month', month);
  if (professionalId) query = query.eq('professional_id', String(professionalId));
  const { data, error } = await query.limit(5000);
  if (error) {
    // Banco ainda sem a tabela: a tela segue sem a parte de nota fiscal.
    if (error.code === 'PGRST205' || error.code === '42P01') return new Map();
    throw error;
  }
  return new Map((data || []).map(row => [invoiceKey(row.unit_id, row.professional_id, row.month), row]));
}

// Envia (ou reenvia) a nota: grava o arquivo, registra como "enviada" e apaga o arquivo anterior.
export async function uploadInvoice({ file, companyId, unitId, professionalId, month, uploadedBy, previous }) {
  const problem = validateInvoiceFile(file);
  if (problem) throw new Error(problem);
  const path = invoicePath({ companyId, professionalId, month, unitId, type: file.type });
  const { error: uploadError } = await supabase.storage.from(INVOICE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const row = {
    company_id: String(companyId),
    unit_id: String(unitId),
    professional_id: String(professionalId),
    month,
    file_path: path,
    file_name: String(file.name || '').slice(0, 200),
    file_size: file.size,
    status: 'enviada',
    review_note: null,
    reviewed_by: null,
    reviewed_at: null,
    uploaded_by: uploadedBy || null,
    updated_date: new Date().toISOString()
  };
  const { data, error } = await supabase.from('invoices')
    .upsert(row, { onConflict: 'company_id,unit_id,professional_id,month' })
    .select(COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(INVOICE_BUCKET).remove([path]);
    throw error;
  }
  if (previous?.file_path && previous.file_path !== path) {
    await supabase.storage.from(INVOICE_BUCKET).remove([previous.file_path]);
  }
  return data;
}

// Abre o arquivo numa aba nova com um link que vale 2 minutos. A aba abre já no clique
// (antes de esperar o banco), senão o navegador a trata como pop-up e bloqueia.
export async function openInvoiceFile(invoice) {
  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Permita pop-ups para abrir a nota.');
  const { data, error } = await supabase.storage.from(INVOICE_BUCKET).createSignedUrl(invoice.file_path, 120);
  if (error || !data?.signedUrl) {
    tab.close();
    throw error || new Error('Não foi possível abrir a nota.');
  }
  tab.location.href = data.signedUrl;
}

// Faturamento aceita ou devolve (com o motivo).
export async function reviewInvoice(invoice, { status, note, reviewedBy }) {
  const { data, error } = await supabase.from('invoices')
    .update({ status, review_note: note || null, reviewed_by: reviewedBy || null, reviewed_at: new Date().toISOString(), updated_date: new Date().toISOString() })
    .eq('id', invoice.id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data;
}
