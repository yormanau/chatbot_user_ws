function showToast(tipo, titulo, mensaje, duration = 4000) {
  const audio = new Audio('/sounds/positive-notification.wav');
  audio.play().catch(() => {});
  const template = document.getElementById('toast-template');
  
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = template.content.cloneNode(true).querySelector('.toast');

  toast.classList.add(`toast--${tipo}`); // toast--success, toast--error, toast--info
  toast.querySelector('.toast__title').textContent = titulo;
  toast.querySelector('.toast__message').textContent = mensaje;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });

  const hide = () => {
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(hide, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); hide(); });
}

export { showToast };