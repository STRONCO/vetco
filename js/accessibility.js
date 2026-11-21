/* ==========================================================================
   VETCO — Accesibilidad moderna y gestión de temas:
   - Sincronización ARIA con :user-invalid y fallback WeakMap
   - Fallback de light-dismiss para <dialog closedby="any">
   - Notificaciones Toast accesibles (popover="manual" + ariaNotify fallback)
   - Aplicación accesible de los 3 temas (dark, light, purple beta)
   ========================================================================== */

(function (global) {
  'use strict';

  const supportsUserInvalid = () =>
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:user-invalid)');

  const supportsPopover = () => Object.hasOwn(HTMLElement.prototype, 'popover');

  const srAnnouncer = document.getElementById('sr-announcer');
  let announceTimer = null;
  let announcedField = null;

  const THEME_META_COLORS = {
    dark: '#090f1a',
    light: '#0f766e',
    purple: '#0e091a'
  };

  function applyTheme(themeName) {
    const valid = ['dark', 'light', 'purple'].includes(themeName) ? themeName : 'dark';
    document.documentElement.setAttribute('data-theme', valid);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_META_COLORS[valid] || THEME_META_COLORS.dark);
    }
    return valid;
  }

  function announceSR(text, delayMs) {
    if (!text) return;
    clearTimeout(announceTimer);
    if (typeof document.ariaNotify === 'function') {
      announceTimer = setTimeout(() => {
        try {
          document.ariaNotify(text);
        } catch {
          if (srAnnouncer) {
            srAnnouncer.textContent = '';
            srAnnouncer.textContent = text;
          }
        }
      }, delayMs || 0);
      return;
    }
    if (!srAnnouncer) return;
    srAnnouncer.textContent = '';
    announceTimer = setTimeout(() => {
      srAnnouncer.textContent = text;
    }, delayMs || 50);
  }

  function spokenText(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => {
      n.replaceWith(`${n.getAttribute('aria-label')}: `);
    });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }

  function linkError(el, shown) {
    const errorId = el.dataset && el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  }

  function announceFieldError(el) {
    const errorId = el.dataset && el.dataset.error;
    if (!errorId) return;
    const errorEl = document.getElementById(errorId);
    if (!errorEl) return;
    const label = el.labels && el.labels[0] ? `${spokenText(el.labels[0])}: ` : '';
    announcedField = el;
    announceSR(label + spokenText(errorEl), 500);
  }

  // ------------------------------------------------------------------------
  // 1. Validación después de interacción (:user-invalid + fallback WeakMap)
  // ------------------------------------------------------------------------
  const dirtyState = new WeakMap();
  const flagged = new WeakSet();
  const announced = new WeakSet();

  function isFieldInvalid(el) {
    if (supportsUserInvalid()) {
      return el.matches(':user-invalid') || el.classList.contains('user-invalid-fallback');
    }
    return el.classList.contains('user-invalid-fallback');
  }

  function syncAria(el, announce) {
    if (!el || !el.matches || !el.matches('input, select, textarea')) return;
    const invalid = isFieldInvalid(el);
    if (invalid) {
      if (announce && !announced.has(el)) {
        announceFieldError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        if (srAnnouncer) srAnnouncer.textContent = '';
      }
    }
  }

  function updateFallbackState(input, announce) {
    const valid = input.validity.valid;
    input.classList.toggle('user-invalid-fallback', !valid);
    input.classList.toggle('user-valid-fallback', valid);
    syncAria(input, announce);
  }

  function initFormValidationA11y(form) {
    if (!form) return;
    const hasNativeUserInvalid = supportsUserInvalid();

    form.querySelectorAll('input, select, textarea').forEach((el) => {
      el.setAttribute('aria-invalid', 'false');
    });

    form.addEventListener(
      'blur',
      (e) => {
        const el = e.target;
        if (!el.matches || !el.matches('input, select, textarea')) return;
        if (hasNativeUserInvalid) {
          syncAria(el, true);
        } else {
          const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
          state.hasBlurred = true;
          dirtyState.set(el, state);
          if (state.hasInteracted) updateFallbackState(el, true);
        }
      },
      true
    );

    form.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.matches || !el.matches('input, select, textarea')) return;
      if (el.classList.contains('user-invalid-fallback') && el.validity.valid) {
        el.classList.remove('user-invalid-fallback');
      }
      if (hasNativeUserInvalid) {
        if (el.hasAttribute('aria-invalid')) syncAria(el, false);
      } else {
        const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        dirtyState.set(el, state);
        if (state.hasBlurred) updateFallbackState(el, false);
      }
    });

    form.addEventListener(
      'change',
      (e) => {
        const el = e.target;
        if (!el.matches || !el.matches('input, select, textarea')) return;
        if (el.classList.contains('user-invalid-fallback') && el.validity.valid) {
          el.classList.remove('user-invalid-fallback');
        }
        if (hasNativeUserInvalid) {
          syncAria(el, true);
        } else {
          const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
          state.hasInteracted = true;
          dirtyState.set(el, state);
          if (state.hasBlurred) updateFallbackState(el, true);
        }
      },
      true
    );

    form.addEventListener(
      'invalid',
      (e) => {
        const el = e.target;
        announced.add(el);
        if (!hasNativeUserInvalid) {
          dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
          el.classList.add('user-invalid-fallback');
        }
        syncAria(el, false);
      },
      true
    );
  }

  function markFieldInvalidOnSubmit(el) {
    if (!el || !el.matches || !el.matches('input, select, textarea')) return;
    el.classList.add('user-invalid-fallback');
    dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
    announced.add(el);
    syncAria(el, false);
  }

  function resetFormValidation(form) {
    if (!form) return;
    for (const el of form.querySelectorAll('input, select, textarea')) {
      dirtyState.delete(el);
      flagged.delete(el);
      announced.delete(el);
      el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
    }
  }

  // ------------------------------------------------------------------------
  // 2. Fallback de light-dismiss para <dialog closedby="any">
  // ------------------------------------------------------------------------
  function initDialogLightDismissFallback() {
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      if (dialog.dataset.ldBound) continue;
      dialog.dataset.ldBound = '1';
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e, dialog)) {
          dialog.close('');
        }
        pressedOutside = false;
      });
    }
  }

  // ------------------------------------------------------------------------
  // 3. Notificaciones Toast accesibles (popover="manual" + pausa en foco)
  // ------------------------------------------------------------------------
  const toastRegion = document.getElementById('toast-region');
  let toastSeq = 0;

  function hasOpenModalDialog() {
    return Boolean(document.querySelector('dialog[open]:modal, dialog[open]'));
  }

  function showToast(message, variant) {
    if (!toastRegion || !message) return;

    if (hasOpenModalDialog() && !supportsPopover()) {
      announceSR(message, 100);
      return;
    }

    const toastId = `vetco-toast-${++toastSeq}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast-item ${variant ? `toast-${variant}` : ''}`.trim();

    if (supportsPopover()) {
      toast.setAttribute('popover', 'manual');
    }

    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    if (variant === 'success') {
      iconWrap.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (variant === 'error') {
      iconWrap.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else {
      iconWrap.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'toast-body';
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    bodyWrap.append(iconWrap, textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.textContent = 'Cerrar';
    closeBtn.setAttribute('aria-label', 'Cerrar notificación');
    if (supportsPopover()) {
      closeBtn.setAttribute('popovertarget', toastId);
      closeBtn.setAttribute('popovertargetaction', 'hide');
    }

    const progress = document.createElement('span');
    progress.className = 'toast-progress';
    progress.setAttribute('aria-hidden', 'true');

    toast.append(bodyWrap, closeBtn, progress);
    toastRegion.append(toast);

    let dismissTimer = null;
    const removeToast = () => {
      clearTimeout(dismissTimer);
      const wasFocused = toast.contains(document.activeElement);
      const nextToast = toast.nextElementSibling || toast.previousElementSibling;
      if (supportsPopover() && typeof toast.hidePopover === 'function') {
        try {
          toast.hidePopover();
        } catch {
          // ya cerrado
        }
      }
      toast.classList.remove('is-visible');
      setTimeout(() => {
        toast.remove();
        if (wasFocused && nextToast) {
          const nextBtn = nextToast.querySelector('button');
          if (nextBtn) nextBtn.focus();
        }
      }, 200);
    };

    const startTimer = () => {
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(() => {
        if (toast.contains(document.activeElement)) return;
        removeToast();
      }, 4800);
    };

    closeBtn.addEventListener('click', removeToast);
    toast.addEventListener('focusin', () => clearTimeout(dismissTimer));
    toast.addEventListener('focusout', startTimer);
    toast.addEventListener('pointerenter', () => clearTimeout(dismissTimer));
    toast.addEventListener('pointerleave', startTimer);

    if (supportsPopover() && typeof toast.showPopover === 'function') {
      try {
        toast.showPopover();
      } catch {
        toast.classList.add('is-visible');
      }
    } else {
      requestAnimationFrame(() => toast.classList.add('is-visible'));
    }

    announceSR(message, 60);
    startTimer();
  }

  global.VETCO_A11Y = {
    applyTheme,
    announceSR,
    initFormValidationA11y,
    markFieldInvalidOnSubmit,
    resetFormValidation,
    initDialogLightDismissFallback,
    showToast
  };
})(window);
