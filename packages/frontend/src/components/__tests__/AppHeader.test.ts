import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '../AppHeader.vue';
import type { ProjectInfo } from '@param-logger/shared';

const defaultProject: ProjectInfo = { projectId: 'proj-1', projectName: 'My Project' };

function mountHeader(overrides: Record<string, unknown> = {}) {
  return mount(AppHeader, {
    props: {
      searchQuery: '',
      resultCountLabel: '0 results',
      isRescanning: false,
      currentProject: defaultProject,
      currentScope: undefined,
      sidebarOpen: false,
      ...overrides,
    },
  });
}

describe('AppHeader', () => {
  describe('DOM structure', () => {
    it('renders the header element with inv-header class', () => {
      const wrapper = mountHeader();
      expect(wrapper.find('header.inv-header').exists()).toBe(true);
    });

    it('renders the logo text', () => {
      const wrapper = mountHeader();
      expect(wrapper.text()).toContain('Param Logger');
    });

    it('renders the search input', () => {
      const wrapper = mountHeader();
      expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    });

    it('binds searchQuery to the input value', () => {
      const wrapper = mountHeader({ searchQuery: 'hello' });
      const input = wrapper.find('input[type="text"]').element as HTMLInputElement;
      expect(input.value).toBe('hello');
    });

    it('renders the result count label', () => {
      const wrapper = mountHeader({ resultCountLabel: '42 results' });
      expect(wrapper.text()).toContain('42 results');
    });
  });

  describe('project pill', () => {
    it('shows projectName when set', () => {
      const wrapper = mountHeader({
        currentProject: { projectId: 'p1', projectName: 'Alpha' },
      });
      expect(wrapper.find('.inv-project-pill').text()).toContain('Alpha');
    });

    it('shows "No project" when projectId is null', () => {
      const wrapper = mountHeader({
        currentProject: { projectId: null, projectName: null },
      });
      expect(wrapper.find('.inv-project-pill').text()).toContain('No project');
    });

    it('shows ellipsis when projectId is set but projectName is null', () => {
      const wrapper = mountHeader({
        currentProject: { projectId: 'p1', projectName: null },
      });
      expect(wrapper.find('.inv-project-pill').text()).toContain('…');
    });
  });

  describe('scope pill', () => {
    it('shows "All scopes" when currentScope is undefined', () => {
      const wrapper = mountHeader({ currentScope: undefined });
      expect(wrapper.find('.inv-scope-pill').text()).toBe('All scopes');
    });

    it('shows the scope name when currentScope is defined', () => {
      const wrapper = mountHeader({ currentScope: { name: 'My Scope' } });
      expect(wrapper.find('.inv-scope-pill').text()).toBe('My Scope');
    });
  });

  describe('rescan button', () => {
    it('renders the rescan button', () => {
      const wrapper = mountHeader();
      const btn = wrapper.find('.inv-header-actions button.inv-btn');
      expect(btn.exists()).toBe(true);
    });

    it('shows "↻ Rescan" when not rescanning', () => {
      const wrapper = mountHeader({ isRescanning: false });
      expect(wrapper.find('.inv-header-actions button.inv-btn').text()).toContain('Rescan');
    });

    it('shows "… Rescan" when rescanning', () => {
      const wrapper = mountHeader({ isRescanning: true });
      expect(wrapper.find('.inv-header-actions button.inv-btn').text()).toContain('Rescan');
    });

    it('is disabled when isRescanning is true', () => {
      const wrapper = mountHeader({ isRescanning: true });
      expect((wrapper.find('.inv-header-actions button.inv-btn').element as HTMLButtonElement).disabled).toBe(true);
    });

    it('is enabled when isRescanning is false', () => {
      const wrapper = mountHeader({ isRescanning: false });
      expect((wrapper.find('.inv-header-actions button.inv-btn').element as HTMLButtonElement).disabled).toBe(false);
    });

    it('emits "rescan" when clicked', async () => {
      const wrapper = mountHeader({ isRescanning: false });
      await wrapper.find('.inv-header-actions button.inv-btn').trigger('click');
      expect(wrapper.emitted('rescan')).toHaveLength(1);
    });
  });

  describe('sidebar toggle', () => {
    it('emits "update:sidebarOpen" with true when sidebar is closed and toggle is clicked', async () => {
      const wrapper = mountHeader({ sidebarOpen: false });
      await wrapper.find('.inv-sidebar-toggle').trigger('click');
      expect(wrapper.emitted('update:sidebarOpen')).toEqual([[true]]);
    });

    it('emits "update:sidebarOpen" with false when sidebar is open and toggle is clicked', async () => {
      const wrapper = mountHeader({ sidebarOpen: true });
      await wrapper.find('.inv-sidebar-toggle').trigger('click');
      expect(wrapper.emitted('update:sidebarOpen')).toEqual([[false]]);
    });
  });

  describe('search input', () => {
    it('emits "update:searchQuery" with the new value on input', async () => {
      const wrapper = mountHeader({ searchQuery: '' });
      const input = wrapper.find('input[type="text"]');
      await input.setValue('test query');
      expect(wrapper.emitted('update:searchQuery')).toEqual([['test query']]);
    });
  });

  describe('expose', () => {
    it('exposes a searchInput ref', () => {
      const wrapper = mountHeader();
      expect(wrapper.vm.searchInput).toBeDefined();
    });
  });
});
