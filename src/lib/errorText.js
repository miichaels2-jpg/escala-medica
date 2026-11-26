// Mensagens de erro do navegador e do banco em português (V0.8.5). O texto original continua
// guardado nos detalhes técnicos; aqui é só o que a pessoa lê.
const RULES = [
  [/Cannot read propert(?:y|ies) of (?:null|undefined)(?: \(reading '([^']+)'\))?|(?:null|undefined) is not an object(?: \(evaluating '[^']*?\.?([\w$]+)'\))?/i,
    m => `A tela tentou usar uma informação que ainda não tinha carregado${m[1] || m[2] ? ` (campo "${m[1] || m[2]}")` : ''}.`],
  [/^([\w$.]+) is not defined$|Can't find variable: ([\w$]+)/i,
    m => `Uma parte do sistema não foi encontrada ("${m[1] || m[2]}"). Recarregar a página costuma resolver.`],
  [/([\w$.]+) is not a function/i,
    m => `O sistema chamou uma ação que não existe ("${m[1]}").`],
  [/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Loading chunk \S+ failed/i,
    () => 'Não foi possível baixar uma parte do app (versão nova publicada ou internet instável). Recarregar a página resolve.'],
  [/Failed to fetch|NetworkError|Load failed|network request failed/i,
    () => 'Sem conexão com o servidor. Confira a internet e tente de novo.'],
  [/duplicate key value violates unique constraint "?([\w]+)"?/i,
    m => `Já existe um registro igual (${m[1]}).`],
  [/permission denied|row-level security|violates row-level security/i,
    () => 'Sem permissão para essa ação.'],
  [/invalid input syntax for type (\w+)(?:: "([^"]*)")?/i,
    m => `Valor inválido para ${m[1] === 'date' ? 'data' : m[1]}${m[2] !== undefined ? ` ("${m[2]}")` : ''}.`],
  [/Maximum call stack size exceeded|too much recursion/i,
    () => 'A tela entrou em repetição sem fim e foi interrompida.'],
  [/ResizeObserver loop/i,
    () => 'Aviso do navegador ao redimensionar a tela (sem efeito para o usuário).'],
  [/Script error\.?$/i,
    () => 'Erro em um script externo, sem detalhes do navegador.']
];

export function errorInPortuguese(message) {
  const text = String(message || '').trim();
  if (!text) return 'Erro inesperado.';
  for (const [pattern, build] of RULES) {
    const match = text.match(pattern);
    if (match) return build(match);
  }
  return text;
}
