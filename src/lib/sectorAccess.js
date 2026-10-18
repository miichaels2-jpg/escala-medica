// Em quais setores um profissional pode ser escalado.
//
// Formato atual: `data.blocked_sectors` guarda só os setores VETADOS. Um setor
// criado depois do cadastro já nasce liberado para quem trabalha na unidade.
// Formato antigo: `data.authorized_sectors` guardava os setores LIBERADOS e
// ficava desatualizado sempre que um setor novo era criado.

function professionalData(professional) {
  return professional?.data || professional?.metadata || {};
}

export function isProfessionalAuthorizedForSector(professional, sectorId) {
  if (!sectorId) return true;
  const data = professionalData(professional);

  if (Array.isArray(data.blocked_sectors)) {
    return !data.blocked_sectors.some(id => String(id) === String(sectorId));
  }

  const authorized = data.authorized_sectors ?? professional?.authorized_sectors;
  if (!Array.isArray(authorized)) return true;
  return authorized.some(id => String(id) === String(sectorId));
}

// Setores vetados = setores das unidades do profissional que ficaram desmarcados.
export function blockedSectorsFrom(authorizedIds, sectors, allowedUnitIds) {
  const authorized = new Set((authorizedIds || []).map(String));
  const units = new Set((allowedUnitIds || []).map(String));
  return (sectors || [])
    .filter(sector => !sector.unit_id || units.has(String(sector.unit_id)))
    .filter(sector => !authorized.has(String(sector.id)))
    .map(sector => String(sector.id));
}

// Converte o formato antigo sem mudar o efeito prático: numa unidade em que o
// cadastro antigo marcou algum setor, os não marcados continuam vetados; numa
// unidade sem nenhum setor marcado (ex.: unidade nova), nada fica vetado.
export function legacyBlockedSectors(authorizedIds, sectors, allowedUnitIds) {
  const authorized = new Set((authorizedIds || []).map(String));
  const restrictedUnits = new Set(
    (sectors || []).filter(sector => authorized.has(String(sector.id))).map(sector => String(sector.unit_id))
  );
  const units = new Set((allowedUnitIds || []).map(String));
  return (sectors || [])
    .filter(sector => units.has(String(sector.unit_id)) && restrictedUnits.has(String(sector.unit_id)))
    .filter(sector => !authorized.has(String(sector.id)))
    .map(sector => String(sector.id));
}

// Lista de setores marcados no formulário a partir do cadastro salvo.
export function authorizedSectorIdsFor(professional, sectors) {
  return (sectors || [])
    .filter(sector => isProfessionalAuthorizedForSector(professional, sector.id))
    .map(sector => String(sector.id));
}

// Unidades em que o profissional atua (para mostrar tudo num único login).
export function getProfessionalUnitIds(professional) {
  const data = professionalData(professional);
  const ids = Array.isArray(data.allowed_unit_ids) && data.allowed_unit_ids.length
    ? data.allowed_unit_ids
    : Array.isArray(professional?.unit_ids) && professional.unit_ids.length
      ? professional.unit_ids
      : professional?.unit_id ? [professional.unit_id] : [];
  return [...new Set(ids.filter(Boolean).map(String))];
}
