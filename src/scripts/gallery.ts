const dialog = document.querySelector<HTMLDialogElement>('#photo-viewer');
const image = document.querySelector<HTMLImageElement>('#viewer-image');
const caption = document.querySelector<HTMLElement>('#viewer-caption');
const position = document.querySelector<HTMLElement>('#viewer-position');
const error = document.querySelector<HTMLElement>('#viewer-error');
const original = document.querySelector<HTMLAnchorElement>('#viewer-original');
const entries = [...document.querySelectorAll<HTMLAnchorElement>('[data-gallery-index]')];
let index = 0;
let trigger: HTMLAnchorElement | null = null;

if (dialog && image && caption && position && error && original && entries.length) {
  const show = (next: number) => {
    index = (next + entries.length) % entries.length;
    const entry = entries[index];
    error.hidden = true;
    image.alt = entry.dataset.alt ?? '';
    image.width = Number(entry.dataset.width);
    image.height = Number(entry.dataset.height);
    image.src = entry.href;
    original.href = entry.href;
    caption.textContent = entry.dataset.caption ?? '';
    position.textContent = `Photo ${index + 1} sur ${entries.length}`;
  };
  document.querySelectorAll<HTMLAnchorElement>('[data-photo]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const selected = entries.findIndex((entry) => entry.dataset.photo === anchor.dataset.photo);
      if (selected < 0 || typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      trigger = anchor;
      show(selected);
      dialog.showModal();
      document.documentElement.classList.add('viewer-open');
    });
  });
  dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-previous]')?.addEventListener('click', () => show(index - 1));
  dialog.querySelector('[data-next]')?.addEventListener('click', () => show(index + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      show(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('viewer-open');
    trigger?.focus({ preventScroll: true });
  });
  image.addEventListener('error', () => {
    error.hidden = false;
    console.error(`Photographie indisponible : ${image.currentSrc || image.src}`);
  });
}
