<template>
  <div id="param-inventory-root" class="inv-app">
    <!-- ───── Header ───── -->
    <header class="inv-header">
      <span class="inv-logo">◆ Param Inventory</span>
      <span class="inv-sep"></span>
      <div class="inv-search">
        <span class="inv-search-icon">⌕</span>
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          placeholder="Search params, endpoints, domains…"
        />
        <kbd>/</kbd>
      </div>
      <span class="inv-result-count">{{ resultCountLabel }}</span>
      <div class="inv-header-actions">
        <button class="inv-btn" @click="exportWordlist">↓ Wordlist</button>
        <span
          class="inv-project-pill"
          :title="currentProject.projectId ? `Project: ${currentProject.projectName ?? currentProject.projectId}` : 'No active Caido project'"
        >▤ {{ currentProject.projectName || (currentProject.projectId ? '…' : 'No project') }}</span>
        <span class="inv-scope-pill">{{ currentScope?.name || 'All scopes' }}</span>
        <span class="inv-conn" :class="{ connected: isConnected }">
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
    </header>

    <!-- ───── Tree (left) ───── -->
    <aside class="inv-tree-panel">
      <div class="inv-tree-toolbar">
        <input
          v-model="treeFilter"
          class="inv-tree-search"
          placeholder="Filter tree…"
        />
        <button class="inv-btn inv-btn-ghost" title="Collapse all" @click="collapseAll">△</button>
        <button class="inv-btn inv-btn-ghost" title="Expand all" @click="expandAll">▽</button>
      </div>

      <div class="inv-tree">
        <div
          class="inv-tree-row"
          :class="{ selected: !selectedScope }"
          @click="selectScope(null)"
        >
          <span class="inv-tree-arrow hidden">▶</span>
          <span class="inv-tree-icon">◉</span>
          <span class="inv-tree-label all">All targets</span>
          <span class="inv-tree-count">{{ scopedParameterCount }}</span>
        </div>

        <template v-for="domain in filteredTree" :key="domain.name">
          <div
            class="inv-tree-row tree-domain"
            :class="{ selected: isDomainSelected(domain.name) }"
            @click="toggleDomain(domain.name)"
          >
            <span class="inv-tree-arrow" :class="{ open: openDomains.has(domain.name) }">▶</span>
            <span class="inv-tree-icon">○</span>
            <span class="inv-tree-label">{{ domain.name }}</span>
            <span class="inv-tree-count">{{ domain.paramCount }}</span>
          </div>

          <div v-if="openDomains.has(domain.name)" class="inv-tree-children">
            <div
              v-for="ep in domain.endpoints"
              :key="ep.method + ep.path"
              class="inv-tree-row tree-endpoint"
              :class="{ selected: isEndpointSelected(domain.name, ep.method, ep.path) }"
              @click.stop="selectScope({ domain: domain.name, method: ep.method, path: ep.path })"
            >
              <span class="inv-tree-arrow hidden">▶</span>
              <span class="method-badge" :class="`m-${ep.method}`">{{ ep.method }}</span>
              <span class="inv-tree-label endpoint">{{ ep.path }}</span>
              <span class="inv-tree-count">{{ ep.params.length }}</span>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- ───── Main panel (right) ───── -->
    <main class="inv-main">
      <div class="inv-filter-bar">
        <span class="inv-filter-label">Location</span>
        <span
          v-for="loc in locationFilters"
          :key="loc.value"
          class="inv-pill"
          :class="{ on: activeLoc === loc.value }"
          @click="activeLoc = loc.value"
        >{{ loc.label }}</span>
        <span class="inv-filter-sep"></span>
        <span class="inv-filter-label">Show</span>
        <span
          class="inv-pill"
          :class="{ on: activeFlags.interesting }"
          @click="activeFlags.interesting = !activeFlags.interesting"
        >Interesting only</span>
        <span
          class="inv-pill"
          :class="{ on: activeFlags.new }"
          @click="activeFlags.new = !activeFlags.new"
        >New only</span>
      </div>

      <div class="inv-table-wrap">
        <div v-if="filteredParameters.length" class="table-container">
          <table class="table-header">
            <thead>
              <tr>
                <th :style="{ width: rowNumWidth + 'px' }"></th>
                <th>Parameter</th>
                <th>Location</th>
                <th>Endpoint</th>
                <th>Value type</th>
                <th>Flags</th>
                <th style="width:60px">Seen</th>
              </tr>
            </thead>
          </table>

          <div class="inv-table-body">
            <RecycleScroller
              class="scroller"
              :items="filteredParameters"
              :item-size="32"
              key-field="id"
              v-slot="{ item: p, index: i }"
            >
              <div
                class="table-row"
                :class="{ selected: selectedParam && selectedParam.id === p.id }"
                @click="openDrawer(p)"
              >
                <div class="table-cell row-num" :style="{ width: rowNumWidth + 'px' }">{{ i + 1 }}</div>
                <div class="table-cell"><span class="param-name">{{ p.name }}</span></div>
                <div class="table-cell"><span class="loc" :class="`loc-${p.location}`">{{ p.location }}</span></div>
                <div class="table-cell endpoint-cell">
                  <span class="method-badge" :class="`m-${p.method}`">{{ p.method }}</span>
                  <span class="endpoint-path">{{ p.normalizedPath }}</span>
                </div>
                <div class="table-cell val-type">{{ p.valueTypes.join(', ') }}</div>
                <div class="table-cell">
                  <span v-if="!p.flags.length" class="dim-dash">—</span>
                  <span
                    v-for="flag in p.flags"
                    :key="flag"
                    class="flag"
                    :class="`flag-${flag}`"
                  >{{ flag }}</span>
                </div>
                <div class="table-cell seen-cell" style="width:60px">{{ p.count }}×</div>
              </div>
            </RecycleScroller>
          </div>
        </div>

        <div v-else-if="isLoading" class="inv-empty">Loading…</div>
        <div v-else-if="currentScope && scopedParameterCount === 0" class="inv-empty inv-scope-empty">
          <div class="scope-empty-panel">
            <h3>Active scope <strong>{{ currentScope.name }}</strong> matches 0 captured parameters.</h3>
            <div class="scope-details">
              <div class="scope-list">
                <span class="scope-label">Allowlist:</span>
                <span class="scope-items">
                  <template v-if="currentScope.allowlist.length">
                    <code v-for="pattern in currentScope.allowlist" :key="pattern" class="scope-pattern">{{ pattern }}</code>
                  </template>
                  <em v-else class="scope-empty-list">(empty)</em>
                </span>
              </div>
              <div class="scope-list">
                <span class="scope-label">Denylist:</span>
                <span class="scope-items">
                  <template v-if="currentScope.denylist.length">
                    <code v-for="pattern in currentScope.denylist" :key="pattern" class="scope-pattern">{{ pattern }}</code>
                  </template>
                  <em v-else class="scope-empty-list">(empty)</em>
                </span>
              </div>
            </div>
            <p class="scope-tip">
              <strong>Tip:</strong> In Caido's Scopes page, prefix entries with <code>*</code> to include subdomains.
            </p>
          </div>
        </div>
        <div v-else class="inv-empty">
          No parameters collected yet. Browse some traffic through Caido to start collecting.
        </div>
      </div>
    </main>

    <!-- ───── Status bar ───── -->
    <footer class="inv-statusbar">
      <span>
        <span class="live-dot" :class="{ off: !isConnected }"></span>
        {{ isConnected ? 'Listening' : 'Disconnected' }} · {{ scopedParameterCount }} unique params
      </span>
      <span>v0.1.0</span>
    </footer>

    <!-- ───── Detail drawer ───── -->
    <aside class="inv-drawer" :class="{ open: !!selectedParam }">
      <div v-if="selectedParam" class="drawer-head">
        <h3>
          <span class="drawer-title">{{ selectedParam.name }}</span>
          <button
            class="d-copy"
            title="Copy parameter name"
            @click="copyText(selectedParam.name)"
          >⎘</button>
        </h3>
        <button class="inv-btn inv-btn-ghost" @click="closeDrawer">✕</button>
      </div>

      <div v-if="selectedParam" class="drawer-body">
        <section class="d-section">
          <h4>Details</h4>
          <div class="d-row">
            <span class="k">Location</span>
            <span class="v">
              <span class="loc" :class="`loc-${selectedParam.location}`">{{ selectedParam.location }}</span>
            </span>
          </div>
          <div class="d-row">
            <span class="k">Endpoint</span>
            <span class="v mono">
              <span class="method-badge" :class="`m-${selectedParam.method}`">{{ selectedParam.method }}</span>
              <span class="endpoint-path-text">{{ selectedParam.normalizedPath }}</span>
              <button
                class="d-copy"
                title="Copy endpoint"
                @click="copyText(`${selectedParam.method} ${selectedParam.domain}${selectedParam.normalizedPath}`)"
              >⎘</button>
            </span>
          </div>
          <div class="d-row">
            <span class="k">Domain</span>
            <span class="v">{{ selectedParam.domain }}</span>
          </div>
          <div class="d-row">
            <span class="k">Value type</span>
            <span class="v">{{ selectedParam.valueTypes.join(', ') }}</span>
          </div>
          <div class="d-row">
            <span class="k">Seen</span>
            <span class="v">{{ selectedParam.count }} request{{ selectedParam.count === 1 ? '' : 's' }}</span>
          </div>
          <div class="d-row">
            <span class="k">First seen</span>
            <span class="v">{{ formatDate(selectedParam.firstSeen) }}</span>
          </div>
          <div class="d-row">
            <span class="k">Last seen</span>
            <span class="v">{{ formatDate(selectedParam.lastSeen) }}</span>
          </div>
          <div v-if="selectedParam.flags.length" class="d-row">
            <span class="k">Flags</span>
            <span class="v">
              <span
                v-for="flag in selectedParam.flags"
                :key="flag"
                class="flag"
                :class="`flag-${flag}`"
              >{{ flag }}</span>
            </span>
          </div>
        </section>
      </div>

      <div v-if="selectedParam" class="drawer-foot">
        <button
          class="inv-btn inv-btn-primary"
          title="Open HTTP History filtered to requests containing this parameter"
          @click="openInHttpHistory(selectedParam)"
        >
          ⇱ View in HTTP History
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, inject, shallowRef, watch } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import type { Caido, HTTPQL } from '@caido/sdk-frontend';
import type {
  InventoryBackendAPI,
  InventoryBackendEvents,
  Parameter,
} from '@param-inventory/shared';
import { ParameterLocation } from '@param-inventory/shared';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';
import { useScope } from '../composables/useScope';
import { useProject } from '../composables/useProject';

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');
const { parameters, isLoading, setLoading, tree } = useInventory();
const { init: initBackend, connectionStatus, refreshInventory } = useBackend();
const { currentScope, init: initScope, isHostInScope, cleanup: cleanupScope, getCurrentScope, explain, refresh: refreshScope } = useScope();
const { currentProject, init: initProject, cleanup: cleanupProject } = useProject();

const isConnected = computed(() => connectionStatus.isConnected);

// ───── Local UI state ─────
const searchQuery = ref('');
const treeFilter = ref('');
const activeLoc = ref<'all' | ParameterLocation>('all');
const activeFlags = reactive({ interesting: false, new: false });
const selectedScope = shallowRef<null | { domain: string; method?: string; path?: string }>(null);
const selectedParam = shallowRef<Parameter | null>(null);
const openDomains = reactive<Set<string>>(new Set());
const searchInput = ref<HTMLInputElement | null>(null);

const locationFilters: Array<{ value: 'all' | ParameterLocation; label: string }> = [
  { value: 'all', label: 'All' },
  { value: ParameterLocation.QUERY, label: 'Query' },
  { value: ParameterLocation.JSON, label: 'JSON' },
  { value: ParameterLocation.FORM, label: 'Form' },
  { value: ParameterLocation.HEADER, label: 'Header' },
  { value: ParameterLocation.COOKIE, label: 'Cookie' },
  { value: ParameterLocation.PATH, label: 'Path' },
];

// ───── Derived state ─────
// First filter by scope to get the scoped parameter set
const scopedParameters = computed(() => parameters.value.filter(p => isHostInScope(p.domain)));
const scopedParameterCount = computed(() => scopedParameters.value.length);

const filteredParameters = computed<Parameter[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();

  return scopedParameters.value.filter((p) => {
    // Existing filters (scope already applied in scopedParameters)
    if (selectedScope.value) {
      if (p.domain !== selectedScope.value.domain) return false;
      if (selectedScope.value.path && p.normalizedPath !== selectedScope.value.path) return false;
      if (selectedScope.value.method && p.method !== selectedScope.value.method) return false;
    }
    if (activeLoc.value !== 'all' && p.location !== activeLoc.value) return false;
    if (activeFlags.interesting && p.flags.length === 0) return false;
    if (activeFlags.new && !p.flags.includes('new' as any)) return false;
    if (q) {
      const hay = `${p.name} ${p.normalizedPath} ${p.domain} ${p.valueTypes.join(' ')} ${p.flags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
});

// Use the memoized tree from the inventory store and apply scope + text filtering
const filteredTree = computed(() => {
  // First filter by scope
  const scopedDomains = tree.value.filter(domain => isHostInScope(domain.name));
  
  const filter = treeFilter.value.trim().toLowerCase();
  if (!filter) {
    return scopedDomains;
  }

  const result = [];
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
    // Count domains within the current scope (use scopedParameters for consistency)
    const domains = new Set(scopedParameters.value.map((p) => p.domain)).size;
    return `${base} across ${domains} domain${domains === 1 ? '' : 's'}`;
  }
  if (selectedScope.value.path) {
    return `${base} in ${selectedScope.value.method} ${selectedScope.value.path}`;
  }
  return `${base} in ${selectedScope.value.domain}`;
});

// ───── Watchers ─────
// When the Caido project changes, drop any selection / filter state that
// references items from the previous project. The actual inventory reload
// (clearing the cache + refetching) is handled by `useBackend` in response
// to the backend's `project-changed` event, so we don't trigger it here.
watch(
  () => currentProject.value.projectId,
  (newId, oldId) => {
    if (newId === oldId) return;
    selectedScope.value = null;
    selectedParam.value = null;
    searchQuery.value = '';
    treeFilter.value = '';
    activeLoc.value = 'all';
    activeFlags.interesting = false;
    activeFlags.new = false;
    openDomains.clear();
    console.info('[Param Inventory] project changed, cleared UI selection', {
      from: oldId ?? null,
      to: newId ?? null,
    });
  },
);

// When the Caido scope changes, narrow the view to the new scope and pull
// fresh data from the backend so results always reflect the active scope.
watch(currentScope, async (newScope, oldScope) => {
  // Clear stale UI state that may reference out-of-scope items.
  selectedScope.value = null;
  selectedParam.value = null;

  // Reset narrowing filters so the user immediately sees the full in-scope
  // set rather than a possibly-empty intersection with the previous filters.
  searchQuery.value = '';
  treeFilter.value = '';
  activeLoc.value = 'all';
  activeFlags.interesting = false;
  activeFlags.new = false;

  console.info('[Param Inventory] scope changed, refreshing results', {
    from: oldScope?.name ?? null,
    to: newScope?.name ?? null,
  });

  // Always refetch from backend so the visible list reflects the latest data
  // under the new scope (also covers cases where parameters arrived while a
  // different scope was active).
  if (caido) {
    try {
      setLoading(true);
      await refreshInventory();
    } catch (error) {
      console.warn('[Param Inventory] Failed to refresh inventory after scope change:', error);
    } finally {
      setLoading(false);
    }
  }

  console.info('[Param Inventory] scope filter result', {
    scope: newScope,
    scoped: scopedParameterCount.value,
    total: parameters.value.length,
  });
});

// ───── Actions ─────
function selectScope(scope: typeof selectedScope.value): void {
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
  for (const d of filteredTree.value) openDomains.add(d.name);
}

function openDrawer(p: Parameter): void {
  selectedParam.value = p;
}

function closeDrawer(): void {
  selectedParam.value = null;
}

function copyText(txt: string): void {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(txt);
  }
}

function exportWordlist(): void {
  const names = [...new Set(filteredParameters.value.map((p) => p.name))].join('\n');
  copyText(names);
}

// Build an HTTPQL query that scopes HTTP History to requests carrying this parameter.
function buildHttpQLForParameter(p: Parameter): string {
  const escape = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const parts: string[] = [];

  parts.push(`req.host.eq:"${escape(p.domain)}"`);
  parts.push(`req.method.eq:"${escape(p.method)}"`);

  // Static path prefix only (drop placeholders like {id} so the filter still matches).
  const staticPath = p.normalizedPath.split('{')[0].replace(/\/+$/, '');
  if (staticPath) {
    parts.push(`req.path.cont:"${escape(staticPath)}"`);
  }

  switch (p.location) {
    case ParameterLocation.QUERY:
      parts.push(`req.query.cont:"${escape(p.name)}="`);
      break;
    case ParameterLocation.JSON:
    case ParameterLocation.FORM:
    case ParameterLocation.MULTIPART:
      parts.push(`req.body.cont:"${escape(p.name)}"`);
      break;
    case ParameterLocation.HEADER:
      parts.push(`req.raw.cont:"${escape(p.name)}:"`);
      break;
    case ParameterLocation.COOKIE:
      parts.push(`req.raw.cont:"${escape(p.name)}="`);
      break;
    case ParameterLocation.PATH:
      // Already constrained by host/method/path prefix above.
      break;
  }

  return parts.join(' AND ');
}

function openInHttpHistory(p: Parameter): void {
  const query = buildHttpQLForParameter(p);
  try {
    caido?.httpHistory?.setQuery?.(query as HTTPQL);
    caido?.navigation?.goTo?.({ id: 'HTTPHistory' });
  } catch (error) {
    console.error('Failed to open HTTP History with query:', query, error);
  }
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeDrawer();
    return;
  }
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    searchInput.value?.focus();
  }
}

onMounted(async () => {
  document.addEventListener('keydown', onKeyDown);
  
  // Expose debug helpers globally (always on, not just in dev mode)
  (window as any).__paramInventoryDebug = {
    getCurrentScope,
    scopedParameters,
    explain,
    getCurrentProject: () => currentProject.value,
    refreshScope: () => refreshScope('debug-helper'),
  };
  
  // Expose for testing in development mode
  const isDev = (import.meta as any).env?.DEV;
  if (isDev) {
    // Import the simulation function dynamically to avoid bundling in production
    import('../mock-caido-sdk').then(({ simulateScopeChange, simulateProjectChange }) => {
      (window as any).vueApp = {
        tree: filteredTree,
        parameters,
        currentScope,
        currentProject,
        upsertTest: () => {
          // Test upsert functionality
          console.log('🧪 Testing upsert functionality...');
          const { upsertParameters } = useInventory();
          upsertParameters([
            {
              id: 'test-upsert-1',
              domain: 'test-upsert.com',
              method: 'GET',
              normalizedPath: '/test',
              location: 'query' as any,
              name: 'test_param',
              valueTypes: ['string' as any],
              flags: ['new' as any],
              count: 1,
              firstSeen: new Date(),
              lastSeen: new Date()
            }
          ]);
          console.log('✅ Upsert test completed');
        },
        simulateScopeChange: (scopeId?: string) => {
          console.log('🧪 Testing scope change to:', scopeId || 'no scope');
          simulateScopeChange(scopeId);
          console.log('✅ Scope change simulation completed');
        },
        simulateProjectChange: (projectId?: string) => {
          console.log('🧪 Testing project change to:', projectId || 'no project');
          simulateProjectChange(projectId);
          console.log('✅ Project change simulation completed');
        }
      };
    });
  }
  
  try {
    setLoading(true);
    if (caido) {
      initBackend(caido);
      initScope(caido);
      void initProject(caido);
    } else {
      console.warn('No Caido SDK provided, running in development mode');
    }
  } catch (error) {
    console.error('Error during app initialization:', error);
  } finally {
    setLoading(false);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
  cleanupScope();
  cleanupProject();
});
</script>
