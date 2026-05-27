<template>
  <div v-if="isLoading" class="inv-empty">Loading…</div>
  <div v-else-if="currentScope && !hasScopedParams" class="inv-empty inv-scope-empty">
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
</template>

<script setup lang="ts">
interface Scope {
  name: string;
  allowlist: string[];
  denylist: string[];
}

defineProps<{
  isLoading: boolean;
  currentScope: Scope | undefined;
  hasScopedParams: boolean;
}>();
</script>
