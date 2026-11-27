import { supabase } from '@/lib/supabase';
import { getProfessionalUnitIds } from '@/lib/sectorAccess';
import { findProfessionalLogin } from '@/lib/accessEmail';

// Incluir um profissional que já existe em outra unidade (V0.9.7): o mesmo cadastro e o mesmo login
// passam a valer também nesta unidade, sem duplicar. Atualiza a ficha e as unidades do login.
export async function addProfessionalToUnit(professional, unitId) {
  const unit = String(unitId);
  const current = getProfessionalUnitIds(professional);
  if (current.includes(unit)) return { already: true };
  const ids = [...current, unit];
  const data = { ...(professional.data || {}), allowed_unit_ids: ids };
  const { error } = await supabase.from('professionals').update({ unit_ids: ids, data }).eq('id', professional.id);
  if (error) throw error;
  const login = await findProfessionalLogin(professional);
  if (login) {
    const loginUnits = Array.isArray(login.data?.allowed_unit_ids) ? login.data.allowed_unit_ids.map(String) : [];
    if (!loginUnits.includes(unit)) {
      await supabase.from('users').update({ data: { ...(login.data || {}), allowed_unit_ids: [...loginUnits, unit] } }).eq('id', login.id);
    }
  }
  return { added: true };
}

export const isInUnit = (professional, unitId) => getProfessionalUnitIds(professional).includes(String(unitId));
