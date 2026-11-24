// Tema claro/escuro. Quem nunca escolheu segue o aparelho (claro ou escuro do sistema);
// depois que a pessoa usa o botão sol/lua, vale a escolha dela. O index.html aplica o mesmo
// critério antes da tela aparecer, para não piscar.
export const THEME_KEY = 'hospital-intelligence-theme';

export function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function savedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export const initialTheme = () => savedTheme() || systemTheme();

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
