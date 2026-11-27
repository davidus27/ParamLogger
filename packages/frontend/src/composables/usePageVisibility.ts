import { readonly, ref } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents } from '@param-logger/shared';

export const PAGE_PATH = '/param-logger';

// Only detachment and display:none count. An opacity or visibility transition
// doesn't resize the root, so the ResizeObserver would never report its end.
export function isRendered(root: HTMLElement): boolean {
  if (!root.isConnected) return false;
  if (typeof root.checkVisibility === 'function') return root.checkVisibility();
  for (let node: HTMLElement | null = root; node; node = node.parentElement) {
    if (node.hidden || getComputedStyle(node).display === 'none') return false;
  }
  return true;
}

// Module-level singleton: useInventory defers its publishes on it, App.vue
// starts tracking on mount. Until tracking starts the page counts as visible,
// so code that never starts it (tests, other entry points) sees no deferral.
const isVisible = ref(true);
let stopTracking: (() => void) | null = null;

export function usePageVisibility() {
  // Caido mounts the app at init() into a detached container, hides other
  // pages behind a display:none ancestor, and may report a page change before
  // or after it swaps the DOM. The ResizeObserver catches the DOM side.
  //
  // These two signals are the only way the inventory learns it has to publish
  // again, so a Caido version that shows the page without firing either one
  // would leave the table on stale data until the next batch or refetch.
  // Verified on Caido 0.57.1 only; the SDK types are 0.56.2 and users run up
  // to 0.59. Check both signals when raising @caido/sdk-frontend.
  function start(root: HTMLElement, caido: Caido<InventoryBackendAPI, InventoryBackendEvents>) {
    stop();

    if (typeof caido.navigation?.onPageChange !== 'function') {
      console.warn(
        '[Param Logger] navigation.onPageChange is not available on this Caido version; the page is treated as always visible.',
      );
      return;
    }

    isVisible.value = isRendered(root);
    const handle = caido.navigation.onPageChange((event) => {
      isVisible.value = event.path === PAGE_PATH || isRendered(root);
    });

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => {
        isVisible.value = isRendered(root);
      });
      observer.observe(root);
    }

    stopTracking = () => {
      handle.stop();
      observer?.disconnect();
    };
  }

  function stop() {
    stopTracking?.();
    stopTracking = null;
    isVisible.value = true;
  }

  return {
    isVisible: readonly(isVisible),
    start,
    stop,
  };
}
