import { supabase } from '@/lib/supabase';
import { getProfessionalUnitIds, isProfessionalAuthorizedForSector } from '@/lib/sectorAccess';
import { recipientFor, sendNotifications } from '@/lib/notifications';

// Comunicados por setor com "li" (V0.10.2). Tabelas announcements e announcement_reads
// (migração 20261128120000). A coordenação publica; quem é da equipe lê e toca em "Li".

const isActive = p => String(p?.status || p?.data?.status || 'ativo').toLowerCase() === 'ativo';

// Quem deve ler: ativos da unidade e, se o comunicado é de um setor, liberados nesse setor.
export function announcementAudience(announcement, professionals = []) {
  return professionals.filter(p => p?.id && isActive(p) &&
    getProfessionalUnitIds(p).includes(String(announcement.unit_id)) &&
    (!announcement.sector_id || isProfessionalAuthorizedForSector(p, announcement.sector_id)));
}

export const isForProfessional = (announcement, professional) => announcementAudience(announcement, [professional]).length > 0;

const missingTable = error => error && (error.code === 'PGRST205' || error.code === '42P01' || /announcement/i.test(error.message || '') && /not find|does not exist/i.test(error.message || ''));

export async function fetchAnnouncements(limit = 50) {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return { list: [], missing: missingTable(error), error };
  return { list: data || [] };
}

export async function fetchReads(announcementIds) {
  if (!announcementIds.length) return [];
  const { data } = await supabase.from('announcement_reads').select('announcement_id, professional_id, read_at').in('announcement_id', announcementIds);
  return data || [];
}

export async function publishAnnouncement({ companyId, unitId, sectorId, title, body, user, sectorName, professionals }) {
  const row = {
    company_id: String(companyId), unit_id: String(unitId), sector_id: sectorId ? String(sectorId) : null,
    title: title.trim(), body: body.trim(), created_by: user?.id ? String(user.id) : null, created_by_name: user?.full_name || null
  };
  const { data, error } = await supabase.from('announcements').insert([row]).select('*').single();
  if (error) throw error;
  const audience = announcementAudience(data, professionals);
  await sendNotifications(audience.map(p => ({
    ...recipientFor(p), company_id: row.company_id, unit_id: row.unit_id,
    type: 'comunicado', category: 'comunicado',
    title: `Comunicado${sectorName ? ` · ${sectorName}` : ''}: ${row.title}`,
    message: row.body.slice(0, 180),
    data: { announcement_id: data.id, url: '/avisos' }
  })));
  return { announcement: data, audience: audience.length };
}

export async function deleteAnnouncement(id) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

export async function markAnnouncementRead(announcement, professionalId) {
  const { error } = await supabase.from('announcement_reads').insert([{ announcement_id: announcement.id, professional_id: String(professionalId), company_id: announcement.company_id }]);
  if (error && error.code !== '23505') throw error;
}
