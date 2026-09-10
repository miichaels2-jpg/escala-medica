import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { notifyProfessional } from '../../shared/notifyProfessional.ts';

async function sendEmail(base44, to, subject, body) {
  if (!to) return;
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
  } catch (e) {
    /* email failure must not break the workflow */
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'request') {
      const { shiftId, companyId, unitId, requesterId, requesterName, targetId, targetName, reason, shiftDate, shiftTime, sectorName } = body;
      if (!shiftId || !companyId || !requesterId) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }
      const swap = await base44.entities.ShiftSwap.create({
        shift_id: shiftId, shift_date: shiftDate,
        requester_id: requesterId, requester_name: requesterName,
        target_id: targetId || '', target_name: targetName || '',
        reason: reason || '', status: 'pendente', company_id: companyId, unit_id: unitId || ''
      });
      // notify company managers/admins
      const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
      const managers = users.filter((u) =>
        u.data?.company_id === companyId && (u.role === 'admin' || u.data?.app_role === 'manager' || u.data?.app_role === 'gestor')
      );
      for (const m of managers) {
        await sendEmail(base44, m.email,
          `Nova solicitação de troca de plantão - ${requesterName}`,
          `<h3 style="color:#0284c7">Nova solicitação de troca de plantão</h3>
           <p><strong>${requesterName}</strong> solicitou troca do plantão de <strong>${shiftDate}</strong> (${shiftTime}) no setor <strong>${sectorName}</strong>.</p>
           <p>Profissional sugerido para a troca: ${targetName || 'Não informado'}</p>
           <p>Motivo: ${reason || 'Não informado'}</p>
           <p>Acesse o MedScale → Trocas de Plantão para aprovar ou rejeitar.</p>`);
      }
      return Response.json({ ok: true, swapId: swap.id });
    }

    if (action === 'approve' || action === 'reject') {
      const { swapId } = body;
      if (!swapId) return Response.json({ error: 'Missing swapId' }, { status: 400 });
      const swap = await base44.entities.ShiftSwap.get(swapId);
      if (!swap) return Response.json({ error: 'Solicitação não encontrada' }, { status: 404 });

      const newStatus = action === 'approve' ? 'aprovada' : 'rejeitada';
      await base44.entities.ShiftSwap.update(swapId, { status: newStatus });

      if (action === 'approve') {
        await base44.entities.Shift.update(swap.shift_id, {
          professional_id: swap.target_id,
          professional_name: swap.target_name,
          status: 'pendente'
        });
        let targetEmail = '';
        try {
          const tp = await base44.entities.Professional.get(swap.target_id);
          targetEmail = tp?.email || '';
        } catch (e) {}
        await notifyProfessional(base44, {
          professionalId: swap.target_id,
          professionalName: swap.target_name,
          shiftId: swap.shift_id,
          companyId: swap.company_id,
          type: 'troca',
          title: 'Plantão transferido para você',
          message: `Um plantão de ${swap.shift_date} foi transferido para você após a aprovação de uma troca.`,
          email: targetEmail
        });
      }

      // notify the requesting professional (best-effort; may be unregistered)
      let requesterEmail = '';
      try {
        const prof = await base44.entities.Professional.get(swap.requester_id);
        requesterEmail = prof?.email || '';
      } catch (e) {}
      await sendEmail(base44, requesterEmail,
        action === 'approve' ? 'Troca de plantão aprovada' : 'Troca de plantão rejeitada',
        `<p>Olá ${swap.requester_name},</p>
         <p>Sua solicitação de troca do plantão de <strong>${swap.shift_date}</strong> foi <strong>${newStatus}</strong>.</p>
         ${action === 'approve' ? '<p>O plantão foi transferido para o profissional solicitado e está aguardando confirmação.</p>' : '<p>Entre em contato com a coordenação se tiver dúvidas.</p>'}`);

      return Response.json({ ok: true, status: newStatus });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}