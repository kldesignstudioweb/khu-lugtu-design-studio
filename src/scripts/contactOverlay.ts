export function openContactOverlay(id = 'contact-overlay') {
  document.dispatchEvent(
    new CustomEvent('contact-overlay:open', { detail: { id } }),
  );
}

export function closeContactOverlay(id = 'contact-overlay') {
  document.dispatchEvent(
    new CustomEvent('contact-overlay:close', { detail: { id } }),
  );
}