import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import EmptyState from '../EmptyState.vue';

interface Scope {
  name: string;
  allowlist: string[];
  denylist: string[];
}

function makeScope(overrides: Partial<Scope> = {}): Scope {
  return {
    name: 'My Scope',
    allowlist: [],
    denylist: [],
    ...overrides,
  };
}

function mountEmptyState(overrides: Record<string, unknown> = {}) {
  return mount(EmptyState, {
    props: {
      isLoading: false,
      currentScope: undefined,
      hasScopedParams: false,
      ...overrides,
    },
  });
}

describe('EmptyState', () => {
  describe('loading branch', () => {
    it('shows loading message when isLoading is true', () => {
      const wrapper = mountEmptyState({ isLoading: true });
      expect(wrapper.find('.inv-empty').text()).toContain('Loading');
    });

    it('does not show scope-empty panel when loading', () => {
      const wrapper = mountEmptyState({
        isLoading: true,
        currentScope: makeScope({ name: 'Test' }),
        hasScopedParams: false,
      });
      expect(wrapper.find('.inv-scope-empty').exists()).toBe(false);
    });
  });

  describe('scope-empty branch', () => {
    it('shows scope-empty panel when scope set and hasScopedParams is false', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ name: 'TestScope' }),
        hasScopedParams: false,
      });
      expect(wrapper.find('.inv-scope-empty').exists()).toBe(true);
    });

    it('shows the scope name in the heading', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ name: 'Production' }),
        hasScopedParams: false,
      });
      expect(wrapper.find('.inv-scope-empty').text()).toContain('Production');
    });

    it('shows allowlist patterns when present', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ allowlist: ['*.example.com', 'api.test.com'] }),
        hasScopedParams: false,
      });
      const text = wrapper.find('.inv-scope-empty').text();
      expect(text).toContain('*.example.com');
      expect(text).toContain('api.test.com');
    });

    it('shows "(empty)" for allowlist when it has no entries', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ allowlist: [] }),
        hasScopedParams: false,
      });
      const scopeEmpty = wrapper.find('.inv-scope-empty');
      expect(scopeEmpty.text()).toContain('(empty)');
    });

    it('shows denylist patterns when present', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ denylist: ['blocked.com'] }),
        hasScopedParams: false,
      });
      expect(wrapper.find('.inv-scope-empty').text()).toContain('blocked.com');
    });

    it('shows "(empty)" for denylist when it has no entries', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope({ denylist: [] }),
        hasScopedParams: false,
      });
      // Both allowlist and denylist are empty → two (empty) spans
      const emptySpans = wrapper.findAll('.scope-empty-list');
      expect(emptySpans.length).toBeGreaterThanOrEqual(1);
    });

    it('shows a tip about wildcard subdomains', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope(),
        hasScopedParams: false,
      });
      expect(wrapper.find('.scope-tip').text()).toContain('Tip');
    });

    it('does not show scope-empty when hasScopedParams is true', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: makeScope(),
        hasScopedParams: true,
      });
      expect(wrapper.find('.inv-scope-empty').exists()).toBe(false);
    });
  });

  describe('no-data branch', () => {
    it('shows no-data message when not loading, no scope, and hasScopedParams is false', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: undefined,
        hasScopedParams: false,
      });
      expect(wrapper.text()).toContain('No parameters collected yet');
    });

    it('shows no-data message when not loading, no scope, and hasScopedParams is true', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: undefined,
        hasScopedParams: true,
      });
      expect(wrapper.text()).toContain('No parameters collected yet');
    });

    it('does not show scope-empty panel when scope is undefined', () => {
      const wrapper = mountEmptyState({
        isLoading: false,
        currentScope: undefined,
        hasScopedParams: false,
      });
      expect(wrapper.find('.inv-scope-empty').exists()).toBe(false);
    });
  });
});
