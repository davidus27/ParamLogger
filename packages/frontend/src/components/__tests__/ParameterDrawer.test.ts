import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ParameterDrawer from '../ParameterDrawer.vue';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'param-1',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/users',
    location: ParameterLocation.QUERY,
    name: 'userId',
    valueTypes: [],
    flags: [],
    count: 3,
    firstSeen: new Date('2024-01-01'),
    lastSeen: new Date('2024-06-15'),
    ...overrides,
  };
}

function mountDrawer(overrides: Record<string, unknown> = {}) {
  return mount(ParameterDrawer, {
    props: {
      parameter: null,
      isSendingToReplay: false,
      ...overrides,
    },
    global: {
      provide: {
        caido: undefined,
      },
    },
  });
}

describe('ParameterDrawer', () => {
  describe('closed state (parameter = null)', () => {
    it('renders the aside element', () => {
      const wrapper = mountDrawer();
      expect(wrapper.find('aside.inv-drawer').exists()).toBe(true);
    });

    it('does not have "open" class when parameter is null', () => {
      const wrapper = mountDrawer({ parameter: null });
      expect(wrapper.find('aside.inv-drawer').classes()).not.toContain('open');
    });

    it('does not render drawer-head when parameter is null', () => {
      const wrapper = mountDrawer({ parameter: null });
      expect(wrapper.find('.drawer-head').exists()).toBe(false);
    });

    it('does not render drawer-body when parameter is null', () => {
      const wrapper = mountDrawer({ parameter: null });
      expect(wrapper.find('.drawer-body').exists()).toBe(false);
    });

    it('does not render drawer-foot when parameter is null', () => {
      const wrapper = mountDrawer({ parameter: null });
      expect(wrapper.find('.drawer-foot').exists()).toBe(false);
    });
  });

  describe('open state (parameter provided)', () => {
    it('has "open" class when parameter is set', () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      expect(wrapper.find('aside.inv-drawer').classes()).toContain('open');
    });

    it('renders drawer-head with parameter name', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ name: 'csrf_token' }) });
      expect(wrapper.find('.drawer-title').text()).toBe('csrf_token');
    });

    it('renders drawer-body', () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      expect(wrapper.find('.drawer-body').exists()).toBe(true);
    });

    it('renders drawer-foot', () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      expect(wrapper.find('.drawer-foot').exists()).toBe(true);
    });
  });

  describe('details section', () => {
    it('shows location', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ location: ParameterLocation.JSON }) });
      const locSpan = wrapper.find('.loc');
      expect(locSpan.text()).toBe('json');
      expect(locSpan.classes()).toContain('loc-json');
    });

    it('shows method and path', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ method: 'POST', normalizedPath: '/submit' }),
      });
      expect(wrapper.find('.method-badge').text()).toBe('POST');
      expect(wrapper.find('.endpoint-path-text').text()).toBe('/submit');
    });

    it('shows domain', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ domain: 'api.example.com' }) });
      const rows = wrapper.findAll('.d-row');
      const domainRow = rows.find(r => r.find('.k').text() === 'Domain');
      expect(domainRow?.find('.v').text()).toBe('api.example.com');
    });

    it('shows value types', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ valueTypes: [ValueType.JWT, ValueType.BASE64] }),
      });
      const rows = wrapper.findAll('.d-row');
      const vtRow = rows.find(r => r.find('.k').text() === 'Value type');
      expect(vtRow?.find('.v').text()).toBe('jwt, base64');
    });

    it('shows seen count with correct singular form', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ count: 1 }) });
      const seenRow = wrapper.findAll('.d-row').find(r => r.find('.k').text() === 'Seen');
      expect(seenRow?.find('.v').text()).toContain('1 time');
    });

    it('shows seen count with correct plural form', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ count: 5 }) });
      const seenRow = wrapper.findAll('.d-row').find(r => r.find('.k').text() === 'Seen');
      expect(seenRow?.find('.v').text()).toContain('5 times');
    });

    it('shows flags when present', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ flags: [Flag.AUTH, Flag.IDOR] }),
      });
      const flagSpans = wrapper.findAll('.flag');
      expect(flagSpans).toHaveLength(2);
    });

    it('hides the flags row when no flags', () => {
      const wrapper = mountDrawer({ parameter: makeParam({ flags: [] }) });
      const flagRow = wrapper.findAll('.d-row').find(r => r.find('.k').text() === 'Flags');
      expect(flagRow).toBeUndefined();
    });
  });

  describe('attack hints', () => {
    it('shows attack hints section when parameter has relevant flags', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ flags: [Flag.REDIRECT] }),
      });
      expect(wrapper.find('.d-hints').exists()).toBe(true);
    });

    it('hides attack hints section when no hints apply', () => {
      // GRAPHQL location has no location-based hint, and empty flags/types → no hints
      const wrapper = mountDrawer({
        parameter: makeParam({ flags: [], valueTypes: [], location: ParameterLocation.GRAPHQL }),
      });
      expect(wrapper.find('.d-hints').exists()).toBe(false);
    });

    it('renders hint rows for each hint', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ flags: [Flag.REDIRECT, Flag.FILE] }),
      });
      const hintRows = wrapper.findAll('.d-hint-row');
      expect(hintRows.length).toBeGreaterThanOrEqual(2);
    });

    it('shows hint icon and label', () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ flags: [Flag.REDIRECT] }),
      });
      const hintRow = wrapper.find('.d-hint-row');
      expect(hintRow.find('.hint-icon').exists()).toBe(true);
      expect(hintRow.find('strong').text()).toContain('Open Redirect');
    });
  });

  describe('emitted events', () => {
    it('emits "close" when close button is clicked', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      await wrapper.find('.drawer-head .inv-btn-ghost').trigger('click');
      expect(wrapper.emitted('close')).toHaveLength(1);
    });

    it('emits "copy" with parameter name when name copy button is clicked', async () => {
      const wrapper = mountDrawer({ parameter: makeParam({ name: 'csrf_token' }) });
      const copyBtns = wrapper.findAll('.d-copy');
      await copyBtns[0].trigger('click');
      expect(wrapper.emitted('copy')?.[0]).toEqual(['csrf_token']);
    });

    it('emits "copy" with endpoint string when endpoint copy button is clicked', async () => {
      const wrapper = mountDrawer({
        parameter: makeParam({
          method: 'GET',
          domain: 'example.com',
          normalizedPath: '/api',
        }),
      });
      const copyBtns = wrapper.findAll('.d-copy');
      await copyBtns[1].trigger('click');
      expect(wrapper.emitted('copy')?.[0]).toEqual(['GET example.com/api']);
    });

    it('emits "open-in-search" with parameter when view in search is clicked', async () => {
      const p = makeParam();
      const wrapper = mountDrawer({ parameter: p });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const viewBtn = footerBtns.find(b => b.text().includes('View in Search'));
      await viewBtn?.trigger('click');
      expect(wrapper.emitted('open-in-search')).toEqual([[p]]);
    });

    it('emits "send-to-replay" with parameter when send to replay is clicked', async () => {
      const p = makeParam();
      const wrapper = mountDrawer({ parameter: p, isSendingToReplay: false });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const replayBtn = footerBtns.find(b => b.text().includes('Replay'));
      await replayBtn?.trigger('click');
      expect(wrapper.emitted('send-to-replay')).toEqual([[p]]);
    });

    it('disables "Send to Replay" button when isSendingToReplay is true', () => {
      const wrapper = mountDrawer({ parameter: makeParam(), isSendingToReplay: true });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const replayBtn = footerBtns.find(b =>
        b.text().includes('Replay') || b.text().includes('…'),
      );
      expect((replayBtn?.element as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('finding form', () => {
    it('shows "Create finding" button when finding form is closed', () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const createBtn = footerBtns.find(b => b.text().includes('Create finding'));
      expect(createBtn?.exists()).toBe(true);
    });

    it('opens the finding form when "Create finding" is clicked', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const createBtn = footerBtns.find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      expect(wrapper.find('.d-finding-form').exists()).toBe(true);
    });

    it('hides the "Create finding" button when form is open', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const footerBtns = wrapper.findAll('.drawer-foot button');
      const createBtn = footerBtns.find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      const btnsAfter = wrapper.findAll('.drawer-foot button');
      expect(btnsAfter.find(b => b.text().includes('Create finding'))).toBeUndefined();
    });

    it('finding form has a title input', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const createBtn = wrapper.findAll('.drawer-foot button').find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      expect(wrapper.find('.d-finding-form input.d-input').exists()).toBe(true);
    });

    it('finding form has a textarea for description', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const createBtn = wrapper.findAll('.drawer-foot button').find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      expect(wrapper.find('.d-finding-form textarea').exists()).toBe(true);
    });

    it('closes the finding form when Cancel is clicked', async () => {
      const wrapper = mountDrawer({ parameter: makeParam() });
      const createBtn = wrapper.findAll('.drawer-foot button').find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      expect(wrapper.find('.d-finding-form').exists()).toBe(true);
      const cancelBtn = wrapper.find('.d-finding-form .inv-btn-ghost');
      await cancelBtn.trigger('click');
      expect(wrapper.find('.d-finding-form').exists()).toBe(false);
    });

    it('pre-fills finding title from parameter flags', async () => {
      const wrapper = mountDrawer({
        parameter: makeParam({ name: 'redirect_url', flags: [Flag.REDIRECT] }),
      });
      const createBtn = wrapper.findAll('.drawer-foot button').find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      const titleInput = wrapper.find('.d-finding-form input.d-input').element as HTMLInputElement;
      expect(titleInput.value).toContain('redirect_url');
      expect(titleInput.value).toContain('redirect');
    });

    it('resets the finding form when parameter changes', async () => {
      const p1 = makeParam({ id: 'p1' });
      const p2 = makeParam({ id: 'p2', name: 'other' });
      const wrapper = mountDrawer({ parameter: p1 });
      const createBtn = wrapper.findAll('.drawer-foot button').find(b => b.text().includes('Create finding'));
      await createBtn?.trigger('click');
      expect(wrapper.find('.d-finding-form').exists()).toBe(true);
      await wrapper.setProps({ parameter: p2 });
      expect(wrapper.find('.d-finding-form').exists()).toBe(false);
    });
  });
});
