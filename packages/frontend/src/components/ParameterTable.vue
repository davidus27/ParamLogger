<template>
  <div class="table-container">
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
        :items="parameters"
        :item-size="32"
        key-field="id"
        v-slot="{ item: p, index: i }"
      >
        <div
          class="table-row"
          :class="{ selected: selectedParam && selectedParam.id === p.id }"
          @click="$emit('row-click', p)"
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
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
import type { Parameter } from '@param-logger/shared';
import { computeRiskScore, getRiskClass } from '../utils/riskScore';

defineProps<{
  parameters: Parameter[];
  selectedParam: Parameter | null;
  rowNumWidth: number;
}>();

defineEmits<{
  'row-click': [parameter: Parameter];
}>();
</script>
