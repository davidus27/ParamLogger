<template>
  <Teleport to="body">
    <div v-if="open" class="help-overlay" @click.self="$emit('update:open', false)">
      <div class="help-modal">
        <button class="help-close" title="Close" @click="$emit('update:open', false)">✕</button>

        <div class="help-content">
          <div class="help-hero">
            <div v-if="HELP_PAGES[page].image" class="help-image-wrap">
              <img :src="HELP_PAGES[page].image" :alt="HELP_PAGES[page].title" />
            </div>
            <div v-else class="help-image-placeholder">
              <span>Image / GIF placeholder</span>
            </div>
          </div>

          <div class="help-text">
            <span class="help-subtitle">{{ HELP_PAGES[page].subtitle }}</span>
            <h2>{{ HELP_PAGES[page].title }}</h2>
            <p v-for="(para, i) in HELP_PAGES[page].body" :key="i">{{ para }}</p>
          </div>
        </div>

        <div class="help-footer">
          <div class="help-dots">
            <span
              v-for="(_, i) in HELP_PAGES"
              :key="i"
              class="help-dot"
              :class="{ active: i === page }"
              @click="$emit('update:page', i)"
            ></span>
          </div>
          <div class="help-nav">
            <button class="inv-btn" :disabled="page === 0" @click="$emit('update:page', page - 1)">← Back</button>
            <button
              v-if="page < HELP_PAGES.length - 1"
              class="inv-btn inv-btn-primary"
              @click="$emit('update:page', page + 1)"
            >Next →</button>
            <button
              v-else
              class="inv-btn inv-btn-primary"
              @click="$emit('update:open', false)"
            >Get started</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { HELP_PAGES } from '../constants/helpPages';

defineProps<{
  open: boolean;
  page: number;
}>();

defineEmits<{
  'update:open': [value: boolean];
  'update:page': [value: number];
}>();
</script>
