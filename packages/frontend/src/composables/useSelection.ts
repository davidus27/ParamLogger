import { shallowRef, reactive } from 'vue';
import type { Parameter } from '@param-logger/shared';

export type ScopeSelection = null | { domain: string; method?: string; path?: string };

export interface UseSelectionOptions {
  /** Called when the drawer is closed so the caller can reset auxiliary state (e.g. finding form). */
  onDrawerClose?: () => void;
  /** Called when the drawer switches to a different parameter so auxiliary state can be cleared. */
  onParamChange?: () => void;
  /** Returns the currently visible tree nodes so expandAll knows which domains to open. */
  getFilteredTree?: () => Array<{ name: string }>;
}

export function useSelection(options?: UseSelectionOptions) {
  const selectedScope = shallowRef<ScopeSelection>(null);
  const selectedParam = shallowRef<Parameter | null>(null);
  const openDomains = reactive<Set<string>>(new Set());

  function selectScope(scope: ScopeSelection): void {
    selectedScope.value = scope;
  }

  function isDomainSelected(domain: string): boolean {
    return !!selectedScope.value && selectedScope.value.domain === domain && !selectedScope.value.path;
  }

  function isEndpointSelected(domain: string, method: string, path: string): boolean {
    return (
      !!selectedScope.value &&
      selectedScope.value.domain === domain &&
      selectedScope.value.method === method &&
      selectedScope.value.path === path
    );
  }

  function toggleDomain(domain: string): void {
    if (openDomains.has(domain)) {
      openDomains.delete(domain);
    } else {
      openDomains.add(domain);
    }
    selectScope({ domain });
  }

  function collapseAll(): void {
    openDomains.clear();
  }

  function expandAll(): void {
    const tree = options?.getFilteredTree?.() ?? [];
    for (const d of tree) openDomains.add(d.name);
  }

  function openDrawer(p: Parameter): void {
    if (selectedParam.value?.id !== p.id) {
      options?.onParamChange?.();
    }
    selectedParam.value = p;
  }

  function closeDrawer(): void {
    selectedParam.value = null;
    options?.onDrawerClose?.();
  }

  return {
    selectedScope,
    selectedParam,
    openDomains,
    selectScope,
    isDomainSelected,
    isEndpointSelected,
    toggleDomain,
    collapseAll,
    expandAll,
    openDrawer,
    closeDrawer,
  };
}
