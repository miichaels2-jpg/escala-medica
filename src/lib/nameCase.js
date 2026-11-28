// Nome de empresa ou unidade em e-mails e documentos (V0.10.10): quem cadastrou tudo em maiúsculas
// ("BASE DE HOMOLOGAÇÃO") vira "Base de Homologação". Siglas (UPA, UTI, HMDAS…) continuam em
// maiúsculas e nomes que já têm minúsculas ("Lima&Lima", "MedTec") ficam como estão.
const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'para', 'com']);
const VOWELS = /[aeiouáéíóúâêôãõà]/gi;

function isAcronym(word) {
  if (word.includes('/')) return word.split('/').every(isAcronym);
  const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters) return true;
  if (/\d/.test(word)) return true;
  if (letters.length <= 3) return true;
  return (letters.match(VOWELS) || []).length <= 1;
}

export function nameCase(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || /[a-zà-ÿ]/.test(text)) return text;
  // Uma palavra só em maiúsculas costuma ser sigla (HIMA, HMDAS): fica como está.
  if (!text.includes(' ')) return text;
  return text.split(' ').map((word, index) => {
    const lower = word.toLocaleLowerCase('pt-BR');
    if (index > 0 && SMALL.has(lower)) return lower;
    if (SMALL.has(lower) && index === 0) return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
    if (isAcronym(word)) return word;
    return lower.replace(/(^|[-/&(])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('pt-BR'));
  }).join(' ');
}

// "UPA Eusébio" · "Unidade A e Unidade B" · "A, B e C"
export function joinNames(names) {
  const list = (names || []).map(nameCase).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}
