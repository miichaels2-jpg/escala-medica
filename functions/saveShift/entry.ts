import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyProfessional } from '../../shared/notifyProfessional.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    async function getEmail(profId) {
      if (!profId) return '';
      try {
        const p = await base44.entities.Professional.get(profId);
        return p?.email || '';
      } catch (e) {
        return '';
      }
    }

    if (action === 'create') {
      const data = body.shiftData;
      const shift = await base44.entities.Shift.create(data);
      if (shift.professional_id && shift.professional_name) {
        await notifyProfessional(base44, {
          professionalId: shift.professional_id,
          professionalName: shift.professional_name,
          shiftId: shift.id,
          companyId: shift.company_id,
          type: 'nova_escala',
          title: 'Novo plantão atribuído a você',
          message: `Você foi escalado para o plantão de ${shift.date} (${shift.start_time} às ${shift.end_time}) no setor ${shift.sector_name || '—'}.`,
          email: await getEmail(shift.professional_id)
        });
      }
      return Response.json({ ok: true, shift });
    }

    if (action === 'update') {
      const { shiftId, shiftData } = body;
      if (!shiftId) return Response.json({ error: 'Missing shiftId' }, { status: 400 });
      const old = await base44.entities.Shift.get(shiftId).catch(() => null);
      const shift = await base44.entities.Shift.update(shiftId, shiftData);
      const oldProf = old?.professional_id || '';
      const newProf = shift.professional_id || '';
      if (newProf && newProf !== oldProf) {
        const isAlteration = !!oldProf;
        await notifyProfessional(base44, {
          professionalId: newProf,
          professionalName: shift.professional_name,
          shiftId: shift.id,
          companyId: shift.company_id,
          type: isAlteration ? 'alteracao' : 'nova_escala',
          title: isAlteration ? 'Alteração na sua escala' : 'Novo plantão atribuído a você',
          message: isAlteration
            ? `Houve uma alteração no seu plantão de ${shift.date} (${shift.start_time} às ${shift.end_time}) no setor ${shift.sector_name || '—'}. Verifique sua escala.`
            : `Você foi escalado para o plantão de ${shift.date} (${shift.start_time} às ${shift.end_time}) no setor ${shift.sector_name || '—'}.`,
          email: await getEmail(newProf)
        });
      }
      return Response.json({ ok: true, shift });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}