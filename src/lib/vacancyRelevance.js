// Para quem uma vaga aberta pode aparecer (V0.10.6). Regra única do app: Mural, sino, avisos de vaga
// urgente, sobreaviso e a Escala vista pelo plantonista. O banco confere a mesma regra ao assumir
// (sm_specialty_ok). Só a coordenação escala alguém fora da especialidade, com confirmação.
import { isProfessionalAuthorizedForSector } from './sectorAccess.js';
import { normalize } from './format.js';
import { isShiftVacant } from './shiftLiveStatus.js';

export function getShiftSpecialty(shift) {
  if (shift?.target_specialty) return shift.target_specialty;
  return String(shift?.notes || '').match(/\[ESP:(.*?)\]/i)?.[1]?.trim() || '';
}

// Mesma especialidade (vaga geral ou sem especialidade aceita qualquer um; quem não tem especialidade
// no cadastro só combina com vaga geral).
export function specialtyMatches(shift, professional) {
  const required = normalize(getShiftSpecialty(shift));
  if (!required || required === 'geral') return true;
  const mine = normalize(professional?.specialty);
  if (!mine) return false;
  return required === mine || required.includes(mine) || mine.includes(required);
}

// A vaga é para este profissional: liberado no setor e da especialidade.
export function isVacancyRelevantFor(shift, professional) {
  if (!professional) return true;
  if (!isProfessionalAuthorizedForSector(professional, shift?.sector_id)) return false;
  return specialtyMatches(shift, professional);
}

// O plantonista vê os plantões preenchidos da escala publicada, mas vaga aberta só se for para ele.
export function isVisibleToProfessional(shift, professional) {
  return !isShiftVacant(shift) || isVacancyRelevantFor(shift, professional);
}
