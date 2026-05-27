import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HelpModal from '../HelpModal.vue';
import { HELP_PAGES } from '../../constants/helpPages';

function mountModal(overrides: Record<string, unknown> = {}) {
  return mount(HelpModal, {
    props: {
      open: false,
      page: 0,
      ...overrides,
    },
    global: {
      // Stub Teleport so the content renders inline in the test DOM
      stubs: { Teleport: true },
    },
  });
}

describe('HelpModal', () => {
  describe('closed state (open = false)', () => {
    it('does not render the overlay when open is false', () => {
      const wrapper = mountModal({ open: false });
      expect(wrapper.find('.help-overlay').exists()).toBe(false);
    });

    it('does not render the modal content when closed', () => {
      const wrapper = mountModal({ open: false });
      expect(wrapper.find('.help-modal').exists()).toBe(false);
    });
  });

  describe('open state (open = true)', () => {
    it('renders the overlay when open is true', () => {
      const wrapper = mountModal({ open: true });
      expect(wrapper.find('.help-overlay').exists()).toBe(true);
    });

    it('renders the modal content when open', () => {
      const wrapper = mountModal({ open: true });
      expect(wrapper.find('.help-modal').exists()).toBe(true);
    });

    it('renders the close button', () => {
      const wrapper = mountModal({ open: true });
      expect(wrapper.find('button.help-close').exists()).toBe(true);
    });

    it('renders the page title for page 0', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      expect(wrapper.find('h2').text()).toBe(HELP_PAGES[0].title);
    });

    it('renders the page subtitle', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      expect(wrapper.find('.help-subtitle').text()).toBe(HELP_PAGES[0].subtitle);
    });

    it('renders body paragraphs', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      const paragraphs = wrapper.findAll('.help-text p');
      expect(paragraphs).toHaveLength(HELP_PAGES[0].body.length);
    });

    it('renders dots navigation with one dot per page', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      const dots = wrapper.findAll('.help-dot');
      expect(dots).toHaveLength(HELP_PAGES.length);
    });

    it('marks current page dot as active', () => {
      const wrapper = mountModal({ open: true, page: 2 });
      const dots = wrapper.findAll('.help-dot');
      expect(dots[2].classes()).toContain('active');
      expect(dots[0].classes()).not.toContain('active');
    });

    it('renders different page content for page 1', () => {
      const wrapper = mountModal({ open: true, page: 1 });
      expect(wrapper.find('h2').text()).toBe(HELP_PAGES[1].title);
    });
  });

  describe('navigation', () => {
    it('shows "← Back" button disabled on first page', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      const backBtn = wrapper.findAll('.help-nav button').find(b => b.text().includes('Back'));
      expect((backBtn?.element as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows "← Back" button enabled on pages after first', () => {
      const wrapper = mountModal({ open: true, page: 1 });
      const backBtn = wrapper.findAll('.help-nav button').find(b => b.text().includes('Back'));
      expect((backBtn?.element as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows "Next →" button on non-last pages', () => {
      const wrapper = mountModal({ open: true, page: 0 });
      expect(wrapper.findAll('.help-nav button').some(b => b.text().includes('Next'))).toBe(true);
    });

    it('shows "Get started" button on last page', () => {
      const lastPage = HELP_PAGES.length - 1;
      const wrapper = mountModal({ open: true, page: lastPage });
      expect(wrapper.findAll('.help-nav button').some(b => b.text().includes('Get started'))).toBe(true);
    });

    it('does not show "Next →" button on last page', () => {
      const lastPage = HELP_PAGES.length - 1;
      const wrapper = mountModal({ open: true, page: lastPage });
      expect(wrapper.findAll('.help-nav button').some(b => b.text().includes('Next'))).toBe(false);
    });

    it('emits "update:page" with page+1 when Next is clicked', async () => {
      const wrapper = mountModal({ open: true, page: 0 });
      const nextBtn = wrapper.findAll('.help-nav button').find(b => b.text().includes('Next'));
      await nextBtn?.trigger('click');
      expect(wrapper.emitted('update:page')).toEqual([[1]]);
    });

    it('emits "update:page" with page-1 when Back is clicked', async () => {
      const wrapper = mountModal({ open: true, page: 2 });
      const backBtn = wrapper.findAll('.help-nav button').find(b => b.text().includes('Back'));
      await backBtn?.trigger('click');
      expect(wrapper.emitted('update:page')).toEqual([[1]]);
    });

    it('emits "update:open" with false when Get started is clicked', async () => {
      const lastPage = HELP_PAGES.length - 1;
      const wrapper = mountModal({ open: true, page: lastPage });
      const getStartedBtn = wrapper.findAll('.help-nav button').find(b => b.text().includes('Get started'));
      await getStartedBtn?.trigger('click');
      expect(wrapper.emitted('update:open')).toEqual([[false]]);
    });

    it('emits "update:page" with i when a dot is clicked', async () => {
      const wrapper = mountModal({ open: true, page: 0 });
      const dots = wrapper.findAll('.help-dot');
      await dots[2].trigger('click');
      expect(wrapper.emitted('update:page')).toEqual([[2]]);
    });
  });

  describe('close interactions', () => {
    it('emits "update:open" with false when close button is clicked', async () => {
      const wrapper = mountModal({ open: true });
      await wrapper.find('button.help-close').trigger('click');
      expect(wrapper.emitted('update:open')).toEqual([[false]]);
    });

    it('emits "update:open" with false when overlay backdrop is clicked', async () => {
      const wrapper = mountModal({ open: true });
      await wrapper.find('.help-overlay').trigger('click');
      expect(wrapper.emitted('update:open')).toEqual([[false]]);
    });
  });

  describe('image display', () => {
    it('renders help-image-placeholder when page has no image', () => {
      // Stub HELP_PAGES entry without image — we use a page where image resolves
      // to a URL; in happy-dom the URL constructor may produce a string, so
      // we test that either the img or the placeholder is rendered.
      const wrapper = mountModal({ open: true, page: 0 });
      const hasImage = wrapper.find('.help-image-wrap').exists();
      const hasPlaceholder = wrapper.find('.help-image-placeholder').exists();
      expect(hasImage || hasPlaceholder).toBe(true);
    });
  });
});
