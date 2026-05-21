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
          <span class="inv-tree-count">{{ parameters.length }}</span>
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
                <th style="width:32px"></th>
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
                <div class="table-cell row-num" style="width:32px">{{ i + 1 }}</div>
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
        <div v-else class="inv-empty">
          No parameters collected yet. Browse some traffic through Caido to start collecting.
        </div>
      </div>
    </main>

    <!-- ───── Status bar ───── -->
    <footer class="inv-statusbar">
      <span>
        <span class="live-dot" :class="{ off: !isConnected }"></span>
        {{ isConnected ? 'Listening' : 'Disconnected' }} · {{ parameters.length }} unique params
      </span>
      <span>v0.1.0</span>
    </footer>

    <!-- ───── Detail drawer ───── -->
    <aside class="inv-drawer" :class="{ open: !!selectedParam }">
      <div v-if="selectedParam" class="drawer-head">
        <h3>{{ selectedParam.name }}</h3>
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
              {{ selectedParam.normalizedPath }}
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
        <button class="inv-btn" @click="copyText(selectedParam.name)">⎘ Copy name</button>
        <button class="inv-btn" @click="copyText(`${selectedParam.method} ${selectedParam.domain}${selectedParam.normalizedPath}`)">
          ⎘ Copy endpoint
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, inject, shallowRef } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import type { Caido } from '@caido/sdk-frontend';
import type {
  InventoryBackendAPI,
  InventoryBackendEvents,
  Parameter,
} from '@param-inventory/shared';
import { ParameterLocation } from '@param-inventory/shared';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');
const { parameters, isLoading, setLoading, tree } = useInventory();
const { init: initBackend, connectionStatus } = useBackend();

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
const filteredParameters = computed<Parameter[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();

  return parameters.value.filter((p) => {
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

// Use the memoized tree from the inventory store and apply filtering
const filteredTree = computed(() => {
  const filter = treeFilter.value.trim().toLowerCase();
  if (!filter) {
    return tree.value;
  }

  const result = [];
  for (const domain of tree.value) {
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

const resultCountLabel = computed(() => {
  const n = filteredParameters.value.length;
  const base = `${n} parameter${n === 1 ? '' : 's'}`;
  if (!selectedScope.value) {
    const domains = new Set(parameters.value.map((p) => p.domain)).size;
    return `${base} across ${domains} domain${domains === 1 ? '' : 's'}`;
  }
  if (selectedScope.value.path) {
    return `${base} in ${selectedScope.value.method} ${selectedScope.value.path}`;
  }
  return `${base} in ${selectedScope.value.domain}`;
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
  
  // Expose for testing in development mode
  if (import.meta.env.DEV) {
    (window as any).vueApp = {
      tree: filteredTree,
      parameters,
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
      }
    };
  }
  
  try {
    setLoading(true);
    if (caido) {
      initBackend(caido);
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
});
</script>
