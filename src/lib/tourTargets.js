// Acha na tela o elemento de um passo do guia (formato dos alvos em screenHelp.js).
const isVisible = el => {
  if (!el || !el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
};

const textOf = el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();

function findOne(spec, root) {
  if (spec.button || spec.buttonStarts) {
    const wanted = spec.button || spec.buttonStarts;
    return [...root.querySelectorAll('button')].find(b => {
      if (!isVisible(b)) return false;
      const text = textOf(b);
      return spec.button ? text === wanted : text.startsWith(wanted);
    }) || null;
  }
  if (spec.selector) {
    return [...root.querySelectorAll(spec.selector)].find(el => isVisible(el) && (!spec.includes || textOf(el).includes(spec.includes))) || null;
  }
  return null;
}

export function findTarget(target) {
  if (!target || typeof document === 'undefined') return null;
  for (const spec of Array.isArray(target) ? target : [target]) {
    const roots = spec.inDialog ? [...document.querySelectorAll('[role=dialog]')] : [document];
    for (const root of roots) {
      const el = findOne(spec, root);
      if (el) return el;
    }
  }
  return null;
}

// Preferências da ajuda (só neste navegador; se o armazenamento falhar, tudo segue funcionando).
export const helpStorage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(`sm_help_${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(`sm_help_${key}`, JSON.stringify(value));
    } catch {
      // modo privado ou armazenamento bloqueado
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(`sm_help_${key}`);
    } catch {
      // idem
    }
  }
};
