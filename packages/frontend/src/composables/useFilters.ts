import { ref, computed, reactive } from 'vue';
import type { ComputedRef, ShallowRef } from 'vue';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType } from '@param-logger/shared';
import { computeRiskScore } from '../utils/riskScore';
import { matchesValueTypeFilter } from '../utils/valueTypes';
import type { ScopeSelection } from './useSelection';

type TreeEndpoint = {
  method: string;
  path: string;
  params: Parameter[];
};

type TreeNode = {
  name: string;
  paramCount: number;
  endpoints: TreeEndpoint[];
};

export function useFilters(
  parameters: ComputedRef<Parameter[]>,
  tree: ComputedRef<TreeNode[]>,
  isHostInScope: (host: string) => boolean,
  selectedScope: ShallowRef<ScopeSelection>,
) {
  const searchQuery = ref('');
  const treeFilter = ref('');
  const activeLoc = ref<'all' | ParameterLocation>('all');
  const activeFlags = reactive<Set<string>>(new Set());
  const activeValueTypes = reactive<Set<ValueType>>(new Set());

  const scopedParameters = computed(() => parameters.value.filter(p => isHostInScope(p.domain)));
  const scopedParameterCount = computed(() => scopedParameters.value.length);

  const filteredParameters = computed<Parameter[]>(() => {
    const q = searchQuery.value.trim().toLowerCase();

    const filtered = scopedParameters.value.filter((p) => {
      if (selectedScope.value) {
        if (p.domain !== selectedScope.value.domain) return false;
        if (selectedScope.value.path && p.normalizedPath !== selectedScope.value.path) return false;
        if (selectedScope.value.method && p.method !== selectedScope.value.method) return false;
      }
      if (activeLoc.value !== 'all' && p.location !== activeLoc.value) return false;
      if (activeFlags.size > 0 && !p.flags.some(f => activeFlags.has(f))) return false;
      if (!matchesValueTypeFilter(p.valueTypes as ValueType[], activeValueTypes)) return false;
      if (q) {
        const hay = `${p.name} ${p.normalizedPath} ${p.domain} ${p.valueTypes.join(' ')} ${p.flags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => computeRiskScore(b) - computeRiskScore(a));
  });

  const filteredTree = computed<TreeNode[]>(() => {
    const scopedDomains = tree.value.filter(domain => isHostInScope(domain.name));

    const filter = treeFilter.value.trim().toLowerCase();
    if (!filter) {
      return scopedDomains;
    }

    const result: TreeNode[] = [];
    for (const domain of scopedDomains) {
      const domainMatch = domain.name.toLowerCase().includes(filter);
      const matchingEndpoints = domain.endpoints.filter(
        (e) =>
          domainMatch ||
          e.path.toLowerCase().includes(filter) ||
          e.method.toLowerCase().includes(filter),
      );

      if (matchingEndpoints.length > 0 || domainMatch) {
        result.push({
          name: domain.name,
          paramCount: matchingEndpoints.reduce((s, e) => s + e.params.length, 0),
          endpoints: matchingEndpoints,
        });
      }
    }

    return result;
  });

  const rowNumWidth = computed(() => {
    const digits = String(Math.max(1, filteredParameters.value.length)).length;
    // ~8px per digit (tabular-nums @ 11px) + 16px total horizontal padding, min 32px.
    return Math.max(32, digits * 8 + 16);
  });

  const resultCountLabel = computed(() => {
    const n = filteredParameters.value.length;
    const base = `${n} parameter${n === 1 ? '' : 's'}`;
    if (!selectedScope.value) {
      const domains = new Set(scopedParameters.value.map((p) => p.domain)).size;
      return `${base} across ${domains} domain${domains === 1 ? '' : 's'}`;
    }
    if (selectedScope.value.path) {
      return `${base} in ${selectedScope.value.method} ${selectedScope.value.path}`;
    }
    return `${base} in ${selectedScope.value.domain}`;
  });

  function toggleFlag(flag: string): void {
    if (activeFlags.has(flag)) {
      activeFlags.delete(flag);
    } else {
      activeFlags.add(flag);
    }
  }

  function toggleValueType(valueType: ValueType): void {
    if (activeValueTypes.has(valueType)) {
      activeValueTypes.delete(valueType);
    } else {
      activeValueTypes.add(valueType);
    }
  }

  function resetFilters(): void {
    searchQuery.value = '';
    treeFilter.value = '';
    activeLoc.value = 'all';
    activeFlags.clear();
    activeValueTypes.clear();
  }

  return {
    searchQuery,
    treeFilter,
    activeLoc,
    activeFlags,
    activeValueTypes,
    filteredParameters,
    filteredTree,
    scopedParameters,
    scopedParameterCount,
    resultCountLabel,
    rowNumWidth,
    toggleFlag,
    toggleValueType,
    resetFilters,
  };
}
