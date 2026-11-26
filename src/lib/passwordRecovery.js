// Recuperação de senha por e-mail (V0.8.6). O link chega pelo Supabase Auth e abre /redefinir-senha;
// a senha nova é salva no cadastro do ScaleMedic, que copia para a conta oficial (gatilho users_sync_auth).

// Cadastros sem e-mail recebem um endereço interno (@scalemedic.local), que não recebe mensagens.
export function isRealEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.endsWith('@scalemedic.local');
}

// Erro que o Supabase devolve no endereço do link (#error=...&error_code=...), em português.
// Retorna '' quando o link não trouxe erro.
export function recoveryLinkError(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const code = params.get('error_code') || params.get('error');
  if (!code) return '';
  if (/otp_expired|expired/i.test(code) || /expired/i.test(params.get('error_description') || '')) {
    return 'Este link expirou ou já foi usado. Peça um novo na tela de entrada, em "Esqueceu a senha?".';
  }
  return 'Este link não é válido. Peça um novo na tela de entrada, em "Esqueceu a senha?".';
}

// Mensagem para falhas ao pedir o link.
export function recoveryRequestError(error) {
  const text = String(error?.message || error || '');
  const wait = text.match(/after (\d+) seconds?/i);
  if (wait) return `Por segurança, aguarde ${wait[1]} segundos para pedir outro link.`;
  if (Number(error?.status) === 429 || /rate limit/i.test(text)) return 'Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(text)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  return 'Não foi possível enviar o link agora. Tente de novo em alguns minutos.';
}
