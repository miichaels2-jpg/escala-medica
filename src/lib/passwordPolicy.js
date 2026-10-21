// Regras de senha pessoal (troca de senha no primeiro acesso ou a qualquer momento).
const COMMON = ['12345678', '123456789', '1234567890', 'changeme123', 'senha123', 'senha1234', 'password1', 'abc12345', 'qwerty123', 'scalemedic1'];

// Retorna a mensagem do problema, ou '' se a senha estiver boa.
export function passwordProblem(password, { username = '', email = '' } = {}) {
  const value = String(password || '');
  if (value.length < 8) return 'A nova senha deve ter pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) return 'Use letras e números na nova senha.';
  if (/^(.)\1+$/.test(value)) return 'A senha não pode ser um caractere repetido.';
  if (COMMON.includes(value.toLowerCase())) return 'Escolha uma senha pessoal: senhas padrão ou de sequência não são aceitas.';
  const lower = value.toLowerCase();
  const login = String(username || '').toLowerCase();
  const mailUser = String(email || '').toLowerCase().split('@')[0];
  if ((login && login.length >= 3 && lower.includes(login)) || (mailUser && mailUser.length >= 3 && lower.includes(mailUser))) {
    return 'A senha não pode conter o seu usuário ou e-mail.';
  }
  return '';
}

export function formatLockWait(seconds) {
  const minutes = Math.max(1, Math.ceil(Number(seconds || 0) / 60));
  return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
}

// Senha provisória aleatória e legível (sem 0/O, 1/l), com letras e números.
// O profissional troca no primeiro acesso.
export function generateProvisionalPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const pick = (chars, n) => Array.from(globalThis.crypto.getRandomValues(new Uint32Array(n)), v => chars[v % chars.length]).join('');
  return 'Sm' + pick(letters, 4) + pick('23456789', 4);
}
