import { defineComponent, h } from 'vue';
import { config } from '@vue/test-utils';

/**
 * Replace RecycleScroller with a simple pass-through that renders all items
 * unconditionally. happy-dom lacks ResizeObserver/window APIs that
 * vue-virtual-scroller relies on, so using the real component would cause
 * errors in the test environment.
 */
const RecycleScrollerStub = defineComponent({
  name: 'RecycleScroller',
  props: {
    items: { type: Array, default: () => [] },
    itemSize: { type: Number, default: null },
    keyField: { type: String, default: 'id' },
    buffer: { type: Number, default: 200 },
    minItemSize: { type: Number, default: null },
    direction: { type: String, default: 'vertical' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: 'recycle-scroller' },
        (props.items as unknown[]).map((item, index) =>
          slots.default?.({ item, index, active: true })
        )
      );
  },
});

config.global.stubs = {
  RecycleScroller: RecycleScrollerStub,
};
