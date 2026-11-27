import pkg from '../../package.json';

// Versão exibida no app (ex.: "V0.1.2"). A fonte é o campo "version" do package.json.
export const APP_VERSION = `V${pkg.version}`;

// Regra de numeração do ScaleMedic:
// cada entrega sobe o último número (0.10.4 → 0.10.5 … → 0.10.20);
// depois do 20, sobe o número do meio e o último recomeça em 1 (0.10.20 → 0.11.1).
// Até a V0.10.3 o limite era 10 (por isso 0.9.10 → 0.10.1).
export const PATCH_LIMIT = 20;

export function nextVersion(current) {
  const match = /^V?(\d+)\.(\d+)\.(\d+)$/i.exec(String(current || '').trim());
  if (!match) throw new Error(`Versão inválida: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  return patch >= PATCH_LIMIT ? `${major}.${minor + 1}.1` : `${major}.${minor}.${patch + 1}`;
}
