import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

export interface UseKeyboardShortcutsOptions {
  /** Plugin page root. Shortcuts fire when this page is the visible Caido page. */
  root: Ref<HTMLElement | null>;
  searchInput: Ref<HTMLInputElement | null>;
  showHelp: Ref<boolean>;
  openHelp: () => void;
  closeHelp: () => void;
  closeDrawer: () => void;
}

/**
 * True when the Param Logger page is the current (visible) Caido page.
 * Focus may sit on the sidebar or document.body after navigation — that still
 * counts, as long as our page is showing. Hidden pages (Replay, Search, …)
 * have display:none on an ancestor and return false.
 */
export function isPluginPageActive(root: HTMLElement | null): boolean {
  if (!root?.isConnected) return false;
  if (typeof root.checkVisibility === 'function') {
    return root.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  }
  let node: HTMLElement | null = root;
  while (node) {
    if (node.hidden) return false;
    const { display, visibility, opacity } = getComputedStyle(node);
    if (display === 'none' || visibility === 'hidden' || opacity === '0') return false;
    node = node.parentElement;
  }
  return true;
}

function getDeepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el instanceof HTMLElement && el.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isEditableElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.getAttribute('role') === 'textbox') return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { root, searchInput, showHelp, openHelp, closeHelp, closeDrawer } = options;

  function onKeyDown(e: KeyboardEvent): void {
    const onPluginPage = isPluginPageActive(root.value);
    const active = getDeepActiveElement();
    const typing = isEditableElement(active);

    if (e.key === 'Escape') {
      if (showHelp.value) {
        closeHelp();
        return;
      }
      if (!onPluginPage) return;
      closeDrawer();
      return;
    }

    if (!onPluginPage || typing) return;

    if (e.key === '?') {
      e.preventDefault();
      openHelp();
      return;
    }
    if (e.key === '/') {
      e.preventDefault();
      searchInput.value?.focus();
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown);
  });
}
