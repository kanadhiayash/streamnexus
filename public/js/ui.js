// UI utilities and interactions for StreamNexus.

class ToastNotification {
  static show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('is-exiting');
      setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  static success(message) {
    this.show(message, 'success');
  }

  static error(message) {
    this.show(message, 'error');
  }

  static info(message) {
    this.show(message, 'info');
  }
}

class ConfirmDialog {
  static show(title, message, onConfirm, onCancel) {
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
    dialog.setAttribute('tabindex', '-1');
    dialog.innerHTML = `
      <div class="confirm-dialog-box">
        <h2 id="confirm-dialog-title">${title}</h2>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-danger" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    const confirmBtn = dialog.querySelector('[data-action="confirm"]');
    const cancelBtn = dialog.querySelector('[data-action="cancel"]');
    cancelBtn.focus();

    const close = (callback) => {
      dialog.remove();
      callback?.();
    };

    confirmBtn.addEventListener('click', () => close(onConfirm));
    cancelBtn.addEventListener('click', () => close(onCancel));
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(onCancel);
    });
  }
}

class LoadingSkeletons {
  static create(count = 6) {
    const container = document.createElement('div');
    container.className = 'grid';

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'card skeleton';
      skeleton.innerHTML = `
        <div class="skeleton-image skeleton"></div>
        <div class="card-content">
          <div class="skeleton-text skeleton"></div>
          <div class="skeleton-text skeleton" style="width: 80%;"></div>
          <div class="skeleton-text skeleton"></div>
        </div>
      `;
      container.appendChild(skeleton);
    }

    return container;
  }
}

const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

function appendCsrfInput(form) {
  const csrfToken = getCsrfToken();
  if (!csrfToken) return;

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = '_csrf';
  input.value = csrfToken;
  form.appendChild(input);
}

function setLoadingState(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Loading...';
    button.classList.add('loading');
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Submit';
    button.classList.remove('loading');
  }
}

function setupNavigationState() {
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav a').forEach(link => {
    const href = link.getAttribute('href');
    const isActive = href === currentPath ||
      (currentPath.startsWith('/admin') && href?.startsWith('/admin')) ||
      (currentPath.startsWith('/streamer') && href?.startsWith('/streamer'));

    if (isActive) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

function setupViewToggle() {
  const grids = document.querySelectorAll('.grid');
  const toggleButtons = document.querySelectorAll('[data-view-toggle]');
  if (grids.length === 0 || toggleButtons.length === 0) return;

  const applyView = (viewType) => {
    grids.forEach(grid => {
      grid.classList.toggle('list-view', viewType === 'list');
    });
    toggleButtons.forEach(button => {
      const isActive = button.dataset.view === viewType;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    localStorage.setItem('viewPreference', viewType);
  };

  toggleButtons.forEach(button => {
    button.addEventListener('click', () => applyView(button.dataset.view));
  });

  applyView(localStorage.getItem('viewPreference') || 'grid');
}

function setupCarousels() {
  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const slides = Array.from(carousel.querySelectorAll('[data-carousel-slide]'));
    const prev = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    if (slides.length <= 1) {
      prev?.setAttribute('disabled', 'true');
      next?.setAttribute('disabled', 'true');
      return;
    }

    let activeIndex = slides.findIndex(slide => slide.classList.contains('active'));
    if (activeIndex < 0) activeIndex = 0;

    const showSlide = (index) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('active', slideIndex === activeIndex);
      });
    };

    prev?.addEventListener('click', () => showSlide(activeIndex - 1));
    next?.addEventListener('click', () => showSlide(activeIndex + 1));
  });
}

function parseModalData() {
  const script = document.getElementById('content-modal-data');
  if (!script) return new Map();

  try {
    const items = JSON.parse(script.textContent || '[]');
    return new Map(items.map(item => [item.id, item]));
  } catch (error) {
    console.error('Failed to parse content modal data', error);
    return new Map();
  }
}

function setupContentModal() {
  const modal = document.querySelector('[data-content-modal]');
  if (!modal) return;

  const modalPanel = modal.querySelector('.content-modal-panel');
  const closeButton = modal.querySelector('[data-modal-close]');
  const dataById = parseModalData();
  let lastFocus = null;

  const fields = {
    image: modal.querySelector('[data-modal-image]'),
    meta: modal.querySelector('[data-modal-meta]'),
    title: modal.querySelector('[data-modal-title]'),
    description: modal.querySelector('[data-modal-description]'),
    price: modal.querySelector('[data-modal-price]'),
    rating: modal.querySelector('[data-modal-rating]'),
    duration: modal.querySelector('[data-modal-duration]'),
    capacity: modal.querySelector('[data-modal-capacity]'),
    cast: modal.querySelector('[data-modal-cast]'),
    shortlistForm: modal.querySelector('[data-modal-shortlist-form]'),
    shortlistButton: modal.querySelector('[data-modal-shortlist-button]'),
    rentForm: modal.querySelector('[data-modal-rent-form]'),
    rentButton: modal.querySelector('[data-modal-rent-button]'),
    detailsLink: modal.querySelector('[data-modal-details-link]'),
  };

  const closeModal = () => {
    modal.setAttribute('hidden', '');
    document.body.classList.remove('modal-open');
    lastFocus?.focus();
  };

  const openModal = (item, trigger) => {
    lastFocus = trigger || document.activeElement;

    fields.image.src = item.image || '/images/default.svg';
    fields.image.alt = item.title;
    fields.meta.textContent = `${item.type.toUpperCase()} / ${item.genre}`;
    fields.title.textContent = item.title;
    fields.description.textContent = item.description;
    fields.price.textContent = `$${item.price}`;
    fields.rating.textContent = item.rating && item.rating !== '0.0' ? `${item.rating}/10` : 'Not rated';
    fields.duration.textContent = item.duration || 'Runtime TBD';
    fields.capacity.textContent = `${item.capacity.remaining} of ${item.capacity.rentalLimit} licences open`;
    fields.cast.textContent = item.cast ? `Cast: ${item.cast}` : '';
    fields.shortlistForm.action = item.shortlistUrl;
    fields.shortlistButton.textContent = item.isShortlisted ? 'Remove from My List' : 'Add to My List';
    fields.rentForm.action = item.rentUrl;
    fields.rentForm.method = 'GET';
    fields.rentButton.disabled = !item.available || item.capacity.isFull;
    fields.rentButton.textContent = item.capacity.isFull ? 'Rental Full' : 'Activate Rental';
    fields.detailsLink.href = item.detailUrl;

    modal.removeAttribute('hidden');
    document.body.classList.add('modal-open');
    modalPanel.focus();
  };

  document.querySelectorAll('[data-modal-content-id]').forEach(trigger => {
    const openFromTrigger = () => {
      const item = dataById.get(trigger.dataset.modalContentId);
      if (item) openModal(item, trigger);
    };

    trigger.addEventListener('click', (event) => {
      if (event.target.closest('a, form, button') && event.target !== trigger) return;
      openFromTrigger();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFromTrigger();
      }
    });
  });

  closeButton?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

function setupForms() {
  window.validateForm = function (formId) {
    const form = document.getElementById(formId);
    if (!form) return true;

    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
      const hasValue = Boolean(input.value.trim());
      input.classList.toggle('error', !hasValue);
      input.setAttribute('aria-invalid', hasValue ? 'false' : 'true');
      if (!hasValue) isValid = false;
    });

    if (!isValid) {
      ToastNotification.error('Please fill in all required fields');
    }

    return isValid;
  };

  document.querySelectorAll('form[data-validate-form]').forEach(form => {
    form.addEventListener('submit', (event) => {
      if (!window.validateForm(form.id)) {
        event.preventDefault();
      }
    });
  });
}

function setupImageFallbacks() {
  document.querySelectorAll('img[data-fallback-src]').forEach(img => {
    img.addEventListener('error', function () {
      const fallbackSrc = this.dataset.fallbackSrc;
      if (fallbackSrc && this.src !== new URL(fallbackSrc, window.location.origin).href) {
        this.src = fallbackSrc;
      }
    });
  });
}

function setupActionButtons() {
  document.querySelectorAll('[data-checkout-id]').forEach(button => {
    button.addEventListener('click', () => {
      window.confirmCheckout(button.dataset.checkoutId);
    });
  });

  document.querySelectorAll('[data-delete-id]').forEach(button => {
    button.addEventListener('click', () => {
      window.confirmDelete(button.dataset.deleteId);
    });
  });
}

function setupToasts() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('signedup')) ToastNotification.success('Account created. Welcome to StreamNexus.');
  if (params.has('rented')) ToastNotification.success('Rental confirmation is active. Your 45-day access window has started.');
  if (params.has('checkout')) ToastNotification.success('Access returned.');
  if (params.has('created')) ToastNotification.success('Content created.');
  if (params.has('updated')) ToastNotification.success('Content updated.');
  if (params.has('deleted')) ToastNotification.success('Content archived.');
  if (params.has('archived')) ToastNotification.success('Title archived.');
}

function setupFocusMode() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      document.body.classList.add('using-keyboard');
    }
  });

  document.addEventListener('mousedown', () => {
    document.body.classList.remove('using-keyboard');
  });
}

window.confirmCheckout = function (rentalId) {
  ConfirmDialog.show(
    'Return access?',
    'This returns the simulated rental access and frees one licence for the title.',
    () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/streamer/rentals/${rentalId}/checkout`;
      appendCsrfInput(form);
      document.body.appendChild(form);
      form.submit();
    }
  );
};

window.confirmDelete = function (contentId) {
  ConfirmDialog.show(
    'Archive title?',
    'This removes the title from the member catalog without deleting the record.',
    () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/admin/content/${contentId}?_method=DELETE`;
      appendCsrfInput(form);
      document.body.appendChild(form);
      form.submit();
    }
  );
};

document.addEventListener('DOMContentLoaded', function () {
  setupNavigationState();
  setupViewToggle();
  setupCarousels();
  setupContentModal();
  setupForms();
  setupImageFallbacks();
  setupActionButtons();
  setupToasts();
  setupFocusMode();
});

window.UI = { ToastNotification, ConfirmDialog, LoadingSkeletons, setLoadingState };
