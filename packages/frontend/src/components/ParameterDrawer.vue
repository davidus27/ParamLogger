<template>
  <aside class="inv-drawer" :class="{ open: !!parameter }">
    <div v-if="parameter" class="drawer-head">
      <h3>
        <span class="drawer-title">{{ parameter.name }}</span>
        <button
          class="d-copy"
          title="Copy parameter name"
          @click="emitCopy(parameter.name)"
        >⎘</button>
      </h3>
      <button class="inv-btn inv-btn-ghost" @click="$emit('close')">✕</button>
    </div>

    <div v-if="parameter" class="drawer-body">
      <section class="d-section">
        <h4>Details</h4>
        <div class="d-row">
          <span class="k">Location</span>
          <span class="v">
            <span class="loc" :class="`loc-${parameter.location}`">{{ parameter.location }}</span>
          </span>
        </div>
        <div class="d-row">
          <span class="k">Endpoint</span>
          <span class="v mono">
            <span class="method-badge" :class="`m-${parameter.method}`">{{ parameter.method }}</span>
            <span class="endpoint-path-text">{{ parameter.normalizedPath }}</span>
            <button
              class="d-copy"
              title="Copy endpoint"
              @click="emitCopy(`${parameter.method} ${parameter.domain}${parameter.normalizedPath}`)"
            >⎘</button>
          </span>
        </div>
        <div class="d-row">
          <span class="k">Domain</span>
          <span class="v">{{ parameter.domain }}</span>
        </div>
        <div class="d-row">
          <span class="k">Value type</span>
          <span class="v">{{ parameter.valueTypes.join(', ') }}</span>
        </div>
        <div class="d-row">
          <span class="k">Seen</span>
          <span class="v">
            {{ parameter.count }} {{ parameter.count === 1 ? 'time' : 'times' }}
          </span>
        </div>
        <div class="d-row">
          <span class="k">Last seen</span>
          <span class="v">{{ formatDate(parameter.lastSeen) }}</span>
        </div>
        <div v-if="parameter.flags.length" class="d-row">
          <span class="k">Flags</span>
          <span class="v">
            <span
              v-for="flag in parameter.flags"
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
            @click="handleSubmitFinding"
          >{{ isSavingFinding ? 'Saving…' : '✓ Save finding' }}</button>
          <button class="inv-btn inv-btn-ghost" @click="cancelFinding">Cancel</button>
        </div>
        <p v-if="findingError" class="d-form-error">{{ findingError }}</p>
        <p v-if="findingSuccess" class="d-form-success">{{ findingSuccess }}</p>
      </section>
    </div>

    <div v-if="parameter" class="drawer-foot">
      <button
        class="inv-btn inv-btn-primary"
        title="Open Search filtered to requests containing this parameter"
        @click="$emit('open-in-search', parameter)"
      >
        ⇱ View in Search
      </button>
      <button
        class="inv-btn"
        title="Send the most recent request containing this parameter to Replay"
        :disabled="isSendingToReplay"
        @click="$emit('send-to-replay', parameter)"
      >{{ isSendingToReplay ? '…' : '▶ Send to Replay' }}</button>
      <button
        v-if="!showFindingForm"
        class="inv-btn"
        title="Create a Caido finding linked to this parameter"
        @click="openFindingForm(parameter)"
      >
        ⚑ Create finding
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, inject, watch } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, Parameter } from '@param-logger/shared';
import { useFindingForm } from '../composables/useFindingForm';
import { getAttackHints } from '../utils/attackHints';
import { formatDate } from '../utils/format';

const props = defineProps<{
  parameter: Parameter | null;
  isSendingToReplay: boolean;
}>();

const emit = defineEmits<{
  close: [];
  'open-in-search': [parameter: Parameter];
  'send-to-replay': [parameter: Parameter];
  copy: [text: string];
}>();

const caido = inject<Caido<InventoryBackendAPI, InventoryBackendEvents>>('caido');

const {
  showFindingForm,
  findingTitle,
  findingDescription,
  isSavingFinding,
  findingError,
  findingSuccess,
  openFindingForm,
  cancelFinding,
  resetFindingForm,
  submitFinding,
} = useFindingForm();

// Reset the finding form whenever the displayed parameter changes or the drawer closes
watch(
  () => props.parameter?.id,
  (newId, oldId) => {
    if (newId !== oldId) resetFindingForm();
  },
);

const attackHints = computed(() => {
  if (!props.parameter) return [];
  return getAttackHints(props.parameter);
});

function emitCopy(text: string): void {
  emit('copy', text);
}

async function handleSubmitFinding(): Promise<void> {
  await submitFinding(caido);
}
</script>
