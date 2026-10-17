export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Configurações grava a logo da matriz em companies.logo_url e também em
// companies.data.logo_url; os impressos precisam aceitar qualquer um dos dois.
export function getCompanyLogoUrl(company) {
  return String(company?.logo_url || company?.data?.logo_url || '').trim();
}

export function getUnitLogoUrl(unit) {
  return String(unit?.logo_url || '').trim();
}

// Dispara a impressão só depois que todas as imagens (logomarcas) terminaram de
// carregar, para que nenhuma saia em branco no PDF/papel.
export const PRINT_WHEN_IMAGES_READY_SCRIPT = `<script>
  window.addEventListener('load', function () {
    var images = Array.prototype.slice.call(document.images || []);
    Promise.all(images.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) { img.onload = img.onerror = resolve; });
    })).then(function () { setTimeout(function () { window.print(); }, 250); });
  });
</script>`;
