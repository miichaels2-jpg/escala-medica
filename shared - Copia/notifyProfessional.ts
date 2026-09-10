export async function notifyProfessional(base44, opts) {
  const {
    professionalId, professionalName, shiftId, companyId,
    type = 'nova_escala', title, message, email
  } = opts;
  if (!professionalId) return;
  try {
    await base44.entities.Notification.create({
      professional_id: professionalId,
      professional_name: professionalName || '',
      shift_id: shiftId || '',
      type,
      title: title || 'Atualização de escala',
      message: message || '',
      read: false,
      company_id: companyId || ''
    });
  } catch (e) {
    /* notification creation must not break the workflow */
  }
  if (email) {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: title || 'Atualização de escala',
        body: `<div style="font-family:sans-serif">
          <p>Olá ${professionalName || ''},</p>
          <p>${message || ''}</p>
          <p style="margin-top:16px;color:#0284c7;font-weight:600;">ScaleMedic CGT — Sistema de Escalas</p>
        </div>`
      });
    } catch (e) {
      /* email to unregistered addresses may be filtered; ignore */
    }
  }
}