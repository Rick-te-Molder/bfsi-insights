// Shared text utilities

// Escapes &, <, > to avoid HTML injection before we build anchors
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Convert plain URLs into <a> links with consistent styling
export function linkify(text?: string): string {
  if (!text) return '';
  const urlRe = /(https?:\/\/[\w.-]+(?:\.[\w.-]+)+(?:[:#?/=][^\s]*)?)/gi;
  return text.replace(urlRe, (u) => {
    const h = escapeHtml(u);
    return `<a href="${h}" target="_blank" rel="noopener" class="text-sky-300 underline underline-offset-2">${h}</a>`;
  });
}
