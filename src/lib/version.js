import pkg from '../../package.json';

// Versão exibida no app (ex.: "V0.1.2"). A fonte é o campo "version" do package.json.
export const APP_VERSION = `V${pkg.version}`;

// Regra de numeração do ScaleMedic:
// cada entrega sobe o último número (0.1.2 → 0.1.3 … → 0.1.10);
// depois do 10, sobe o número do meio e o último recomeça em 1 (0.1.10 → 0.2.1).
export const PATCH_LIMIT = 10;

export function nextVersion(current) {
  const match = /^V?(\d+)\.(\d+)\.(\d+)$/i.exec(String(current || '').trim());
  if (!match) throw new Error(`Versão inválida: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  return patch >= PATCH_LIMIT ? `${major}.${minor + 1}.1` : `${major}.${minor}.${patch + 1}`;
}
