import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';

export interface UseKeyboardShortcutsOptions {
  searchInput: Ref<HTMLInputElement | null>;
  showHelp: Ref<boolean>;
  openHelp: () => void;
  closeHelp: () => void;
  closeDrawer: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { searchInput, showHelp, openHelp, closeHelp, closeDrawer } = options;

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (showHelp.value) {
        closeHelp();
        return;
      }
      closeDrawer();
      return;
    }
    if (
      e.key === '?' &&
      document.activeElement?.tagName !== 'INPUT' &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      e.preventDefault();
      openHelp();
      return;
    }
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
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
