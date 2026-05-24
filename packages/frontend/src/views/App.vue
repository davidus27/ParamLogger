<template>
  <div id="param-logger-root" class="inv-app">
    <!-- ───── Header ───── -->
    <header class="inv-header">
      <button class="inv-btn inv-btn-ghost inv-sidebar-toggle" @click="sidebarOpen = !sidebarOpen">☰</button>
      <span class="inv-logo">◆ Param Logger</span>
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
        <button
          class="inv-btn"
          :disabled="isRescanning"
          title="Clear the inventory and rescan the current project from scratch"
          @click="triggerRescan"
        >{{ isRescanning ? '… Rescan' : '↻ Rescan' }}</button>
        <span
          class="inv-project-pill"
          :title="currentProject.projectId ? `Project: ${currentProject.projectName ?? currentProject.projectId}` : 'No active Caido project'"
        >▤ {{ currentProject.projectName || (currentProject.projectId ? '…' : 'No project') }}</span>
        <span class="inv-scope-pill">{{ currentScope?.name || 'All scopes' }}</span>
      </div>
    </header>

    <!-- ───── Sidebar backdrop ───── -->
    <div v-if="sidebarOpen" class="inv-sidebar-backdrop" @click="sidebarOpen = false"></div>

    <!-- ───── Tree (left) ───── -->
    <aside class="inv-tree-panel" :class="{ 'sidebar-open': sidebarOpen }">
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
        <div class="inv-filter-group">
          <span class="inv-filter-label">Location</span>
          <span
            v-for="loc in locationFilters"
            :key="loc.value"
            class="inv-pill"
            :class="{ on: activeLoc === loc.value }"
            @click="activeLoc = loc.value"
          >{{ loc.label }}</span>
        </div>
        <span class="inv-filter-sep"></span>
        <div class="inv-filter-group">
          <span class="inv-filter-label">Flags</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('file') }"
            @click="toggleFlag('file')"
          >file</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('sensitive') }"
            @click="toggleFlag('sensitive')"
          >sensitive</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('auth') }"
            @click="toggleFlag('auth')"
          >auth</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('redirect') }"
            @click="toggleFlag('redirect')"
          >redirect</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('new') }"
            @click="toggleFlag('new')"
          >new</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('idor') }"
            @click="toggleFlag('idor')"
          >idor</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('ssti') }"
            @click="toggleFlag('ssti')"
          >ssti</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('injection') }"
            @click="toggleFlag('injection')"
          >injection</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('debug') }"
            @click="toggleFlag('debug')"
          >debug</span>
          <span
            class="inv-pill"
            :class="{ on: activeFlags.has('proto') }"
            @click="toggleFlag('proto')"
          >proto</span>
        </div>
        <span class="inv-filter-sep"></span>
        <div class="inv-filter-group">
          <span class="inv-filter-label">Value type</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.JWT) }"
            @click="toggleValueType(ValueType.JWT)"
          >jwt</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.URL) }"
            @click="toggleValueType(ValueType.URL)"
          >url</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.EMAIL) }"
            @click="toggleValueType(ValueType.EMAIL)"
          >email</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.UUID) }"
            @click="toggleValueType(ValueType.UUID)"
          >uuid</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.BASE64) }"
            @click="toggleValueType(ValueType.BASE64)"
          >base64</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.HASH) }"
            @click="toggleValueType(ValueType.HASH)"
          >hash</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.INTEGER) }"
            @click="toggleValueType(ValueType.INTEGER)"
          >integer</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.BOOLEAN) }"
            @click="toggleValueType(ValueType.BOOLEAN)"
          >boolean</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.TIMESTAMP) }"
            @click="toggleValueType(ValueType.TIMESTAMP)"
          >timestamp</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.IP) }"
            @click="toggleValueType(ValueType.IP)"
          >ip</span>
          <span
            class="inv-pill"
            :class="{ on: activeValueTypes.has(ValueType.SERIALIZED) }"
            @click="toggleValueType(ValueType.SERIALIZED)"
          >serialized</span>
        </div>
      </div>

      <div class="inv-table-wrap">
        <div v-if="filteredParameters.length" class="table-container">
          <div class="table-header">
            <div class="table-head-cell row-num" :style="{ width: rowNumWidth + 'px' }"></div>
            <div class="table-head-cell col-param">Parameter</div>
            <div class="table-head-cell col-loc">Location</div>
            <div class="table-head-cell col-endpoint">Endpoint</div>
            <div class="table-head-cell col-valtype">Value type</div>
            <div class="table-head-cell col-flags">Flags</div>
            <div class="table-head-cell col-risk">Risk</div>
          </div>

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
                <div class="table-cell risk-cell">
                  <div class="risk-score">
                    <span class="risk-number">{{ computeRiskScore(p) }}</span>
                    <div class="risk-bar">
                      <div 
                        class="risk-fill" 
                        :class="getRiskClass(computeRiskScore(p))"
                        :style="{ width: computeRiskScore(p) + '%' }"
                      ></div>
                    </div>
                  </div>
                </div>
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
      <span class="inv-statusbar-right">
        <button
          class="inv-btn-help"
          title="How to use Param Logger"
          @click="openHelp"
        >?</button>
        <span>v0.1.0</span>
      </span>
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
            <span class="v">
              {{ selectedParam.count }} {{ selectedParam.count === 1 ? 'time' : 'times' }}
            </span>
     
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

        <!-- Attack surface hints -->
        <section v-if="attackHints.length" class="d-section d-hints">
          <h4>Things to check <span class="d-hints-badge">heuristic</span></h4>
          <div
            v-for="hint in attackHints"
            :key="hint.label"
            class="d-hint-row"
          >
            <span class="hint-icon">{{ hint.icon }}</span>
            <span class="hint-body">
              <strong>{{ hint.label }}</strong>
              <span class="hint-desc">{{ hint.desc }}</span>
            </span>
          </div>
        </section>

        <!-- Create Finding form -->
        <section v-if="showFindingForm" class="d-section d-finding-form">
          <h4>Create finding</h4>
          <input
            v-model="findingTitle"
            class="d-input"
            placeholder="Title (e.g. Reflected param – open redirect)"
            maxlength="200"
          />
          <textarea
            v-model="findingDescription"
            class="d-textarea"
            placeholder="Notes (optional)"
            rows="3"
          />
          <div class="d-form-actions">
            <button
              class="inv-btn inv-btn-primary"
              :disabled="!findingTitle.trim() || isSavingFinding"
              @click="submitFinding"
            >{{ isSavingFinding ? 'Saving…' : '✓ Save finding' }}</button>
            <button class="inv-btn inv-btn-ghost" @click="cancelFinding">Cancel</button>
          </div>
          <p v-if="findingError" class="d-form-error">{{ findingError }}</p>
          <p v-if="findingSuccess" class="d-form-success">{{ findingSuccess }}</p>
        </section>
      </div>

      <div v-if="selectedParam" class="drawer-foot">
        <button
          class="inv-btn inv-btn-primary"
          title="Open Search filtered to requests containing this parameter"
          @click="openInSearch(selectedParam)"
        >
          ⇱ View in Search
        </button>
        <button
          class="inv-btn"
          title="Send the most recent request containing this parameter to Replay"
          :disabled="isSendingToReplay"
          @click="sendToReplay(selectedParam)"
        >{{ isSendingToReplay ? '…' : '▶ Send to Replay' }}</button>
        <button
          v-if="!showFindingForm"
          class="inv-btn"
          title="Create a Caido finding linked to this parameter"
          @click="openFindingForm(selectedParam)"
        >
          ⚑ Create finding
        </button>
      </div>
    </aside>

    <!-- ───── Help modal ───── -->
    <Teleport to="body">
      <div v-if="showHelp" class="help-overlay" @click.self="closeHelp">
        <div class="help-modal">
          <button class="help-close" title="Close" @click="closeHelp">✕</button>

          <div class="help-content">
            <div class="help-hero">
              <div v-if="HELP_PAGES[helpPage].image" class="help-image-wrap">
                <img :src="HELP_PAGES[helpPage].image" :alt="HELP_PAGES[helpPage].title" />
              </div>
              <div v-else class="help-image-placeholder">
                <span>Image / GIF placeholder</span>
              </div>
            </div>

            <div class="help-text">
              <span class="help-subtitle">{{ HELP_PAGES[helpPage].subtitle }}</span>
              <h2>{{ HELP_PAGES[helpPage].title }}</h2>
              <p v-for="(para, i) in HELP_PAGES[helpPage].body" :key="i">{{ para }}</p>
            </div>
          </div>

          <div class="help-footer">
            <div class="help-dots">
              <span
                v-for="(_, i) in HELP_PAGES"
                :key="i"
                class="help-dot"
                :class="{ active: i === helpPage }"
                @click="helpPage = i"
              ></span>
            </div>
            <div class="help-nav">
              <button class="inv-btn" :disabled="helpPage === 0" @click="helpPrev">← Back</button>
              <button
                v-if="helpPage < HELP_PAGES.length - 1"
                class="inv-btn inv-btn-primary"
                @click="helpNext"
              >Next →</button>
              <button
                v-else
                class="inv-btn inv-btn-primary"
                @click="closeHelp"
              >Get started</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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
} from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';
import { useInventory } from '../composables/useInventory';
import { useBackend } from '../composables/useBackend';
import { useScope } from '../composables/useScope';
import { useProject } from '../composables/useProject';

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');
const { parameters, isLoading, setLoading, tree } = useInventory();
const { init: initBackend, connectionStatus, refreshInventory, resetAndRescan } = useBackend();
const { currentScope, init: initScope, isHostInScope, cleanup: cleanupScope, getCurrentScope, explain, refresh: refreshScope } = useScope();
const { currentProject, init: initProject, cleanup: cleanupProject } = useProject();

const isConnected = computed(() => connectionStatus.isConnected);

// ───── Local UI state ─────
const searchQuery = ref('');
const treeFilter = ref('');
const activeLoc = ref<'all' | ParameterLocation>('all');
const activeFlags = reactive<Set<string>>(new Set());
const activeValueTypes = reactive<Set<ValueType>>(new Set());
const selectedScope = shallowRef<null | { domain: string; method?: string; path?: string }>(null);
const selectedParam = shallowRef<Parameter | null>(null);
const openDomains = reactive<Set<string>>(new Set());
const searchInput = ref<HTMLInputElement | null>(null);
const sidebarOpen = ref(false);

// ───── Help modal ─────
const showHelp = ref(false);
const helpPage = ref(0);
const HELP_PAGES = [
  {
    title: 'Welcome to Param Logger',
    subtitle: 'Introduction',
    image: new URL('../assets/help/preview.png', import.meta.url).href,
    body: [
      'Param Logger watches your Caido HTTP history in the background and builds a deduplicated inventory of every parameter the target accepts.',
      'Each parameter is classified by value type, flagged for security-relevant patterns, and scored by risk so the most interesting candidates surface first.',
      'Use this guide to learn how each part of the interface works.',
    ],
  },
  {
    title: 'Targets',
    subtitle: 'Domain & endpoint tree',
    image: new URL('../assets/help/targets.png', import.meta.url).href,
    body: [
      'The left tree groups parameters by domain and endpoint, so you can scope the table to a single host or route.',
      'Click a domain to filter; expand it to drill into individual endpoints. The badge shows the unique parameter count for that node.',
      'Use the search box at the top to jump to a specific host or path.',
    ],
  },
  {
    title: 'Parameters',
    subtitle: 'The main inventory table',
    image: new URL('../assets/help/params.png', import.meta.url).href,
    body: [
      'The table lists every unique parameter Param Logger has captured, with its location, endpoint, detected value type, flags, and risk score.',
      'Flags are assigned by name pattern, value content, and location. For example, names like `redirect`, `next`, or `url` get the redirect flag; values that parse as a JWT get the jwt value type; numeric or UUID values on auth-related names get idor.',
      'The risk score (0 to 100) combines flag severity, value type sensitivity, and observation count. Rows sort by score, so use it to prioritise which parameters to investigate first.',
    ],
  },
  {
    title: 'Details',
    subtitle: 'Parameter deep-dive drawer',
    image: new URL('../assets/help/detail.png', import.meta.url).href,
    body: [
      'Clicking a row opens the drawer with full metadata: location, endpoint, value type, observation count, and timestamps.',
      '"Things to check" is a context-aware list of hints based on the parameter\'s flags, value type, and location, suggesting concrete tests you can run against it.',
      'From the footer, jump to Caido Search filtered to matching requests, send the latest request to Replay, or create a Finding linked to the parameter.',
    ],
  },
  {
    title: 'Filtering & Search',
    subtitle: 'Narrowing down results',
    image: new URL('../assets/help/filters.png', import.meta.url).href,
    body: [
      'The filter bar narrows the table by location, security flag, or value type. Filters and tree selection compose, so combine them to slice the inventory precisely.',
      'The global header search matches names, endpoints, domains, value types, and flags at once. Press / to focus it from anywhere.',
    ],
  },
] as const;

function openHelp(): void {
  helpPage.value = 0;
  showHelp.value = true;
}
function closeHelp(): void {
  showHelp.value = false;
}
function helpNext(): void {
  if (helpPage.value < HELP_PAGES.length - 1) helpPage.value++;
}
function helpPrev(): void {
  if (helpPage.value > 0) helpPage.value--;
}

const locationFilters: Array<{ value: 'all' | ParameterLocation; label: string }> = [
  { value: 'all', label: 'All' },
  { value: ParameterLocation.QUERY, label: 'Query' },
  { value: ParameterLocation.JSON, label: 'JSON' },
  { value: ParameterLocation.FORM, label: 'Form' },
  { value: ParameterLocation.HEADER, label: 'Header' },
  { value: ParameterLocation.COOKIE, label: 'Cookie' },
  { value: ParameterLocation.PATH, label: 'Path' },
];

// ───── Risk scoring ─────
/**
 * Computes a security risk score (0-100) for a parameter based on flags, value types, and count spread.
 * Higher scores indicate higher potential security risk.
 */
function computeRiskScore(param: Parameter): number {
  let score = 0;
  
  // Flag weights (sum capped at 60 points)
  const flagWeights: Record<string, number> = {
    [Flag.REFLECTED]: 30,
    [Flag.IDOR]: 25,
    [Flag.INJECTION]: 20,
    [Flag.SSTI]: 20,
    [Flag.PROTO_POLLUTION]: 20,
    [Flag.FILE]: 15,
    [Flag.REDIRECT]: 15,
    [Flag.SENSITIVE]: 10,
    [Flag.AUTH]: 10,
    [Flag.DEBUG]: 5,
  };
  
  let flagScore = 0;
  for (const flag of param.flags) {
    flagScore += flagWeights[flag] || 0;
  }
  score += Math.min(flagScore, 60);
  
  // Value type risk weights (sum capped at 20 points)
  const valueTypeWeights: Partial<Record<ValueType, number>> = {
    [ValueType.JWT]: 15,
    [ValueType.SERIALIZED]: 15,
    [ValueType.IP]: 10,
    [ValueType.URL]: 10,
    [ValueType.HASH]: 8,
    [ValueType.BASE64]: 5,
  };
  
  let valueTypeScore = 0;
  for (const valueType of param.valueTypes) {
    valueTypeScore += valueTypeWeights[valueType as ValueType] || 0;
  }
  score += Math.min(valueTypeScore, 20);
  
  // Count spread bonus (log2(count) * 3, capped at 20 points)
  const countBonus = Math.log2(Math.max(1, param.count)) * 3;
  score += Math.min(countBonus, 20);
  
  return Math.min(Math.round(score), 100);
}

/**
 * Returns CSS class for risk visualization based on score.
 */
function getRiskClass(score: number): string {
  if (score >= 70) return 'risk-high';
  if (score >= 35) return 'risk-mid';
  return 'risk-low';
}

// ───── Derived state ─────
// First filter by scope to get the scoped parameter set
const scopedParameters = computed(() => parameters.value.filter(p => isHostInScope(p.domain)));
const scopedParameterCount = computed(() => scopedParameters.value.length);

const filteredParameters = computed<Parameter[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();

  const filtered = scopedParameters.value.filter((p) => {
    // Existing filters (scope already applied in scopedParameters)
    if (selectedScope.value) {
      if (p.domain !== selectedScope.value.domain) return false;
      if (selectedScope.value.path && p.normalizedPath !== selectedScope.value.path) return false;
      if (selectedScope.value.method && p.method !== selectedScope.value.method) return false;
    }
    if (activeLoc.value !== 'all' && p.location !== activeLoc.value) return false;
    // if any flags are selected, param must carry at least one of them
    if (activeFlags.size > 0 && !p.flags.some(f => activeFlags.has(f))) return false;
    // if any value types are selected, param must carry at least one of them
    if (!matchesValueTypeFilter(p.valueTypes as ValueType[], activeValueTypes)) return false;
    if (q) {
      const hay = `${p.name} ${p.normalizedPath} ${p.domain} ${p.valueTypes.join(' ')} ${p.flags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Sort by risk score (descending) by default
  return filtered.sort((a, b) => computeRiskScore(b) - computeRiskScore(a));
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
    activeFlags.clear();
    activeValueTypes.clear();
    openDomains.clear();
    console.info('[Param Logger] project changed, cleared UI selection', {
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
  activeFlags.clear();
  activeValueTypes.clear();

  console.info('[Param Logger] scope changed, refreshing results', {
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
      console.warn('[Param Logger] Failed to refresh inventory after scope change:', error);
    } finally {
      setLoading(false);
    }
  }

  console.info('[Param Logger] scope filter result', {
    scope: newScope,
    scoped: scopedParameterCount.value,
    total: parameters.value.length,
  });
});

// ───── Actions ─────
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

/** Returns true when a ValueType is any UUID variant (generic or versioned). */
function isUUIDValueType(t: ValueType): boolean {
  return t === ValueType.UUID || (t as string).startsWith('uuid_');
}

/**
 * Checks whether the parameter's value types satisfy the active filter set.
 * The generic UUID filter pill matches all versioned UUID types so users don't
 * have to toggle each variant individually.
 */
function matchesValueTypeFilter(paramTypes: ValueType[], active: Set<ValueType>): boolean {
  if (active.size === 0) return true;
  for (const activeType of active) {
    if (activeType === ValueType.UUID) {
      if (paramTypes.some(isUUIDValueType)) return true;
    } else {
      if (paramTypes.includes(activeType)) return true;
    }
  }
  return false;
}

function selectScope(scope: typeof selectedScope.value): void {
  selectedScope.value = scope;
  sidebarOpen.value = false; // Close sidebar when a tree item is selected
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
  openDrawerParam(p);
}

function closeDrawer(): void {
  selectedParam.value = null;
  showFindingForm.value = false;
  findingError.value = '';
  findingSuccess.value = '';
}

function openDrawerParam(p: Parameter): void {
  if (selectedParam.value?.id !== p.id) {
    showFindingForm.value = false;
    findingError.value = '';
    findingSuccess.value = '';
  }
  selectedParam.value = p;
}

function copyText(txt: string): void {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(txt);
  }
}


const isRescanning = ref(false);

async function triggerRescan(): Promise<void> {
  if (isRescanning.value) return;
  isRescanning.value = true;
  try {
    selectedParam.value = null;
    refreshScope('rescan');
    await resetAndRescan();
  } catch (error) {
    console.error('[Param Inventory] Failed to trigger rescan:', error);
  } finally {
    isRescanning.value = false;
  }
}

// Escape a literal string for embedding inside a double-quoted HTTPQL value
// (backslashes and double quotes need escaping).
function escapeHttpQLString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Escape a literal string so it can be embedded inside a Rust-flavoured regex
// (used by HTTPQL `regex`/`nregex` operators) and matched as plain text.
function escapeRegexLiteral(s: string): string {
  return s.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&');
}

// Build a Rust-flavoured regex that matches exactly the parameter's normalized
// path, treating placeholders like `{id}`, `{uuid}`, `{hash}` as a single
// path segment (`[^/]+`). Anchored with `^…$` so we don't pick up sibling or
// child endpoints the way `req.path.cont` did.
//
// An optional trailing `/?` is appended (except for the bare root `/`) so that
// a path Caido stores with a trailing slash (e.g. `/api/`) still matches the
// normalised form `/api` that the inventory records. `normalizePath` always
// strips trailing slashes, so without this the HTTPQL query returns 0 results
// for any endpoint whose path ends with `/`.
function buildPathRegex(normalizedPath: string): string {
  const segments = normalizedPath.split('/');
  const escapedSegments = segments.map((segment) => {
    if (segment.length === 0) return '';
    if (/^\{[^}]+\}$/.test(segment)) {
      return '[^/]+';
    }
    return escapeRegexLiteral(segment);
  });
  const joined = escapedSegments.join('/');
  return joined === '/' ? '^/$' : `^${joined}/?$`;
}

// Return the leaf key of a flattened JSON parameter name, i.e. the segment that
// will actually appear (quoted) in the raw JSON body. The parser produces names
// like `user.name`, `users[].name`, `data.items[0].id` — only the last key is
// present in the body, so that's what we match against.
function jsonLeafKey(name: string): string {
  let s = name.replace(/\[\d*\]+$/, '');
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx >= 0) s = s.slice(dotIdx + 1);
  s = s.replace(/\[\d*\]$/, '');
  return s;
}

// Build an HTTPQL query that scopes Search to requests carrying this
// parameter. The query is intentionally conservative: every clause is anchored
// (regex or exact-match) so the count in Search agrees with the
// per-parameter `count` we display in the inventory.
function buildHttpQLForParameter(p: Parameter): string {
  const parts: string[] = [];

  // Host. Caido's `req.host` is the raw `Host:` header value, which may include
  // a `:<port>` suffix. Match either form, case-insensitively (hostnames are
  // case-insensitive per RFC 3986), so a request to `Example.com:8080` still
  // resolves to a parameter we stored under `example.com`.
  parts.push(
    `req.host.regex:"${escapeHttpQLString(`(?i)^${escapeRegexLiteral(p.domain)}(?::\\d+)?$`)}"`,
  );

  parts.push(`req.method.eq:"${escapeHttpQLString(p.method)}"`);

  // Path: anchored regex with placeholders → `[^/]+`, so an inventory row for
  // `/api/users/{id}/profile` doesn't also match `/api/users` or
  // `/api/users/123/settings` the way `req.path.cont:"/api/users"` did.
  parts.push(
    `req.path.regex:"${escapeHttpQLString(buildPathRegex(p.normalizedPath))}"`,
  );

  switch (p.location) {
    case ParameterLocation.QUERY: {
      // `req.query` excludes the leading `?`, so a parameter at the start of
      // the query string has nothing before it, and any other parameter is
      // preceded by `&`. Anchor accordingly so `id` doesn't match `userid`.
      const nameLit = escapeRegexLiteral(p.name);
      parts.push(
        `req.query.regex:"${escapeHttpQLString(`(?:^|&)${nameLit}=`)}"`,
      );
      break;
    }
    case ParameterLocation.FORM:
      // Use case-insensitive substring matching (`cont`) instead of `regex`
      // on `req.raw`. The `regex` operator can return 0 results for requests
      // where the raw bytes aren't stored as searchable text (e.g. HTTP/2
      // traffic with HPACK-compressed headers). `cont` uses a different
      // search path that is more reliable. The host + method + path clauses
      // already constrain the result set, so the precision loss is minimal.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}=`)}"`,
      );
      break;
    case ParameterLocation.JSON: {
      // Match the quoted JSON key name. `cont` is more reliable than `regex`
      // on `req.raw` (see FORM comment above).
      const leaf = jsonLeafKey(p.name);
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`"${leaf}"`)}"`,
      );
      break;
    }
    case ParameterLocation.MULTIPART:
      // Match the Content-Disposition field name.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`name="${p.name}"`)}"`,
      );
      break;
    case ParameterLocation.HEADER:
      // Match "HeaderName:" substring. `cont` is case-insensitive which
      // covers both HTTP/1.1 mixed-case and HTTP/2 lower-cased header names.
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}:`)}"`,
      );
      break;
    case ParameterLocation.COOKIE:
      // Match "cookieName=" substring. Using `cont` instead of `regex` on
      // `req.raw` avoids the 0-result issue where req.raw.regex fails to
      // search within Cookie headers (observed with HTTP/2 traffic where raw
      // bytes aren't indexed as searchable text for the regex operator).
      parts.push(
        `req.raw.cont:"${escapeHttpQLString(`${p.name}=`)}"`,
      );
      break;
    case ParameterLocation.PATH:
      // The path regex above already constrains this case exactly.
      break;
  }

  return parts.join(' AND ');
}

function openInSearch(p: Parameter): void {
  const query = buildHttpQLForParameter(p);
  try {
    caido?.search?.setQuery?.(query as HTTPQL);
    caido?.navigation?.goTo?.({ id: 'Search' });
  } catch (error) {
    console.error('Failed to open Search with query:', query, error);
  }
}

// ───── Attack surface hints ─────
interface AttackHint {
  icon: string;
  label: string;
  desc: string;
}

const attackHints = computed<AttackHint[]>(() => {
  const p = selectedParam.value;
  if (!p) return [];
  const hints: AttackHint[] = [];
  const flags = p.flags;
  const types = p.valueTypes;
  const loc = p.location;

  // ── Flag-based hints ──

  if (flags.includes(Flag.REDIRECT)) {
    hints.push({
      icon: '↗',
      label: 'Open Redirect',
      desc: 'Controls a redirect target — try substituting an external URL.',
    });
  }

  if (flags.includes(Flag.FILE)) {
    hints.push({
      icon: '📁',
      label: 'Path Traversal / LFI',
      desc: 'References a file path — test for directory traversal sequences.',
    });
  }

  if (flags.includes(Flag.AUTH)) {
    hints.push({
      icon: '🔑',
      label: 'Auth Control',
      desc: 'Influences auth decisions — try empty, null, or elevated role values.',
    });
  }

  if (flags.includes(Flag.IDOR)) {
    hints.push({
      icon: '🎯',
      label: 'IDOR Candidate',
      desc: 'Auth-related name with numeric value — swap with another user\'s ID.',
    });
  }

  if (flags.includes(Flag.SSTI)) {
    hints.push({
      icon: '🧩',
      label: 'SSTI',
      desc: 'Name suggests template processing — probe with {{7*7}} or ${7*7}.',
    });
  }

  if (flags.includes(Flag.INJECTION)) {
    hints.push({
      icon: '💉',
      label: 'Injection',
      desc: 'Name suggests query/command input — test SQLi, NoSQLi, or OS command injection.',
    });
  }

  if (flags.includes(Flag.DEBUG)) {
    hints.push({
      icon: '🐛',
      label: 'Debug / Info Disclosure',
      desc: 'May toggle debug mode — try true, 1, verbose to surface internal state.',
    });
  }

  if (flags.includes(Flag.PROTO_POLLUTION)) {
    hints.push({
      icon: '🦠',
      label: 'Prototype Pollution',
      desc: 'Contains __proto__ or constructor — may pollute JS object prototypes.',
    });
  }

  // ── Value-type hints ──

  if (types.includes(ValueType.JWT)) {
    hints.push({
      icon: '🔐',
      label: 'JWT',
      desc: 'Carries a JWT — check for alg:none, weak secrets, and claim tampering.',
    });
  }

  if (flags.includes(Flag.SENSITIVE) && !types.includes(ValueType.JWT)) {
    hints.push({
      icon: '👁',
      label: 'Sensitive Value',
      desc: 'Looks like a credential or token — verify it isn\'t reflected or cached.',
    });
  }

  const hasUUID = types.some(isUUIDValueType);
  if (types.includes(ValueType.INTEGER) || hasUUID) {
    let desc = 'Contains a direct object ID — substitute with another user\'s value.';
    if (hasUUID) {
      if (types.includes(ValueType.UUID_V1) || types.includes(ValueType.UUID_V6)) {
        desc = 'UUID v1/v6 embeds timestamp + MAC — IDs may be predictable.';
      } else if (types.includes(ValueType.UUID_V7)) {
        desc = 'UUID v7 encodes a timestamp — nearby IDs can be brute-forced.';
      } else if (types.includes(ValueType.UUID_COMPOUND)) {
        desc = 'Compound UUID format — try tampering the timestamp suffix separately.';
      } else if (types.includes(ValueType.UUID_V3) || types.includes(ValueType.UUID_V5)) {
        desc = 'Deterministic UUID (v3/v5) — if namespace is known, IDs are predictable.';
      } else {
        desc = 'Contains a UUID identifier — try swapping with another account\'s UUID.';
      }
    }
    hints.push({
      icon: '🆔',
      label: 'IDOR',
      desc,
    });
  }

  if (types.includes(ValueType.URL)) {
    hints.push({
      icon: '🌐',
      label: 'SSRF',
      desc: 'Accepts a URL — test with internal addresses and cloud metadata endpoints.',
    });
  }

  if (types.includes(ValueType.BOOLEAN)) {
    hints.push({
      icon: '🔓',
      label: 'Boolean Bypass',
      desc: 'Boolean value may gate access — try flipping or omitting it.',
    });
  }

  if (types.includes(ValueType.EMAIL)) {
    hints.push({
      icon: '✉',
      label: 'User Enumeration',
      desc: 'Email field — compare responses for valid vs. invalid addresses.',
    });
  }

  if (types.includes(ValueType.BASE64)) {
    hints.push({
      icon: '📦',
      label: 'Encoded Payload',
      desc: 'Base64 value — decode and inspect for serialized objects or tokens.',
    });
  }

  if (types.includes(ValueType.HASH)) {
    hints.push({
      icon: '🔏',
      label: 'Hash / HMAC',
      desc: 'Contains a hash — check if you can recompute it after modifying data.',
    });
  }

  if (types.includes(ValueType.DECIMAL)) {
    hints.push({
      icon: '💰',
      label: 'Numeric Manipulation',
      desc: 'Decimal value — try negatives, zero, and large numbers for logic flaws.',
    });
  }

  // ── Location-based hints ──

  if (loc === ParameterLocation.QUERY || loc === ParameterLocation.FORM || loc === ParameterLocation.JSON) {
    hints.push({
      icon: '💉',
      label: `Injection (${loc.toUpperCase()})`,
      desc: 'User-controlled input in a common injection location — test SQLi, XSS, SSTI.',
    });
  }

  if (loc === ParameterLocation.HEADER) {
    hints.push({
      icon: '📋',
      label: 'Header Injection',
      desc: 'Request header — test CRLF injection and forwarded-header spoofing.',
    });
  }

  if (loc === ParameterLocation.COOKIE) {
    hints.push({
      icon: '🍪',
      label: 'Cookie Manipulation',
      desc: 'Cookie value — check attributes, session fixation, and decode the value.',
    });
  }

  if (loc === ParameterLocation.PATH) {
    hints.push({
      icon: '🗂',
      label: 'Path IDOR / Traversal',
      desc: 'Embedded in URL path — try ID substitution and encoded traversal.',
    });
  }

  if (loc === ParameterLocation.MULTIPART) {
    hints.push({
      icon: '📤',
      label: 'File Upload',
      desc: 'Multipart field — test extension bypass, content-type mismatch, and path traversal in filename.',
    });
  }

  return hints;
});

// ───── Send to Replay ─────
const isSendingToReplay = ref(false);

async function sendToReplay(p: Parameter): Promise<void> {
  if (isSendingToReplay.value || !caido) return;
  isSendingToReplay.value = true;
  try {
    const ids: string[] = await caido.backend.getRequestIdsForParam(p.id);
    if (!ids || ids.length === 0) {
      // Fall back to Search so the user can pick a request manually
      openInSearch(p);
      return;
    }
    const requestId = ids[0];
    await caido.replay.createSession({ type: 'ID', id: requestId });
    caido.navigation.goTo('Replay');
  } catch (error) {
    console.error('[Param Logger] sendToReplay failed:', error);
    // Graceful fallback
    openInSearch(p);
  } finally {
    isSendingToReplay.value = false;
  }
}

// ───── Create Finding ─────
const showFindingForm = ref(false);
const findingTitle = ref('');
const findingDescription = ref('');
const isSavingFinding = ref(false);
const findingError = ref('');
const findingSuccess = ref('');
let findingParamId = '';

function openFindingForm(p: Parameter): void {
  findingParamId = p.id;
  // Pre-fill the title with a useful default based on the param's flags
  const flag = p.flags.find(f => f !== 'new');
  const typeHint = flag ? ` (${flag})` : '';
  findingTitle.value = `${p.name}${typeHint} — ${p.method} ${p.normalizedPath}`;
  findingDescription.value = '';
  findingError.value = '';
  findingSuccess.value = '';
  showFindingForm.value = true;
}

function cancelFinding(): void {
  showFindingForm.value = false;
  findingError.value = '';
  findingSuccess.value = '';
}

async function submitFinding(): Promise<void> {
  if (!caido || isSavingFinding.value || !findingTitle.value.trim()) return;
  isSavingFinding.value = true;
  findingError.value = '';
  findingSuccess.value = '';
  try {
    const ids: string[] = await caido.backend.getRequestIdsForParam(findingParamId);
    if (!ids || ids.length === 0) {
      findingError.value = 'No captured request found for this parameter yet. Browse some traffic first.';
      return;
    }
    const requestId = ids[0];
    await caido.findings.createFinding(requestId, {
      title: findingTitle.value.trim(),
      description: findingDescription.value.trim() || undefined,
      reporter: 'Param Logger',
    });
    findingSuccess.value = 'Finding created! View it in the Findings page.';
    setTimeout(() => {
      showFindingForm.value = false;
      findingSuccess.value = '';
    }, 2500);
  } catch (error) {
    console.error('[Param Logger] createFinding failed:', error);
    findingError.value = 'Failed to create finding. See console for details.';
  } finally {
    isSavingFinding.value = false;
  }
}

function formatDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (showHelp.value) {
      closeHelp();
      return;
    }
    closeDrawer();
    return;
  }
  if (e.key === '?' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    openHelp();
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
