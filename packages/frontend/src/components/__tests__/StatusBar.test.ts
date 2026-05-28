import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBar from '../StatusBar.vue';

function mountStatusBar(overrides: Record<string, unknown> = {}) {
  return mount(StatusBar, {
    props: {
      isConnected: true,
      scopedParameterCount: 0,
      ...overrides,
    },
  });
}

describe('StatusBar', () => {
  describe('DOM structure', () => {
    it('renders the footer with inv-statusbar class', () => {
      const wrapper = mountStatusBar();
      expect(wrapper.find('footer.inv-statusbar').exists()).toBe(true);
    });

    it('renders the help button', () => {
      const wrapper = mountStatusBar();
      expect(wrapper.find('button.inv-btn-help').exists()).toBe(true);
    });

    it('renders the version string', () => {
      const wrapper = mountStatusBar();
      expect(wrapper.text()).toContain('v0.1.3');
    });
  });

  describe('connection state', () => {
    it('shows "Listening" when connected', () => {
      const wrapper = mountStatusBar({ isConnected: true });
      expect(wrapper.text()).toContain('Listening');
    });

    it('shows "Disconnected" when not connected', () => {
      const wrapper = mountStatusBar({ isConnected: false });
      expect(wrapper.text()).toContain('Disconnected');
    });

    it('live-dot does not have "off" class when connected', () => {
      const wrapper = mountStatusBar({ isConnected: true });
      expect(wrapper.find('.live-dot').classes()).not.toContain('off');
    });

    it('live-dot has "off" class when disconnected', () => {
      const wrapper = mountStatusBar({ isConnected: false });
      expect(wrapper.find('.live-dot').classes()).toContain('off');
    });
  });

  describe('parameter count', () => {
    it('shows 0 unique params when count is 0', () => {
      const wrapper = mountStatusBar({ scopedParameterCount: 0 });
      expect(wrapper.text()).toContain('0 unique params');
    });

    it('shows the correct count', () => {
      const wrapper = mountStatusBar({ scopedParameterCount: 123 });
      expect(wrapper.text()).toContain('123 unique params');
    });
  });

  describe('help button', () => {
    it('emits "open-help" when help button is clicked', async () => {
      const wrapper = mountStatusBar();
      await wrapper.find('button.inv-btn-help').trigger('click');
      expect(wrapper.emitted('open-help')).toHaveLength(1);
    });
  });
});
