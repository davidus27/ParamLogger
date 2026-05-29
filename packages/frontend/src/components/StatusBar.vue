<template>
  <footer class="inv-statusbar">
    <span>
      <span class="live-dot" :class="{ off: !isConnected }"></span>
      {{ isConnected ? 'Listening' : 'Disconnected' }} · {{ scopedParameterCount }} unique params
    </span>
    <span class="inv-statusbar-right">
      <button
        class="inv-btn-help"
        title="How to use Param Logger"
        @click="$emit('open-help')"
      >?</button>
      <span>v0.1.4</span>
    </span>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  isConnected: boolean;
  scopedParameterCount: number;
}>();

defineEmits<{
  'open-help': [];
}>();
</script>
