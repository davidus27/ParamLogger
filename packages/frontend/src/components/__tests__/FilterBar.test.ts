import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterBar from '../FilterBar.vue';
import { ParameterLocation, ValueType } from '@param-logger/shared';
import { locationFilters, FILTER_FLAGS, FILTER_VALUE_TYPES } from '../../constants/filterConfig';

function mountFilterBar(overrides: Record<string, unknown> = {}) {
  return mount(FilterBar, {
    props: {
      activeLoc: 'all' as 'all' | ParameterLocation,
      activeFlags: new Set<string>(),
      activeValueTypes: new Set<ValueType>(),
      ...overrides,
    },
  });
}

describe('FilterBar', () => {
  describe('DOM structure', () => {
    it('renders the filter bar container', () => {
      const wrapper = mountFilterBar();
      expect(wrapper.find('.inv-filter-bar').exists()).toBe(true);
    });

    it('renders three filter groups', () => {
      const wrapper = mountFilterBar();
      expect(wrapper.findAll('.inv-filter-group')).toHaveLength(3);
    });

    it('renders all location filter pills', () => {
      const wrapper = mountFilterBar();
      const locGroup = wrapper.findAll('.inv-filter-group')[0];
      const pills = locGroup.findAll('.inv-pill');
      expect(pills).toHaveLength(locationFilters.length);
    });

    it('renders all flag filter pills', () => {
      const wrapper = mountFilterBar();
      const flagGroup = wrapper.findAll('.inv-filter-group')[1];
      const pills = flagGroup.findAll('.inv-pill');
      expect(pills).toHaveLength(FILTER_FLAGS.length);
    });

    it('renders all value type filter pills', () => {
      const wrapper = mountFilterBar();
      const vtGroup = wrapper.findAll('.inv-filter-group')[2];
      const pills = vtGroup.findAll('.inv-pill');
      expect(pills).toHaveLength(FILTER_VALUE_TYPES.length);
    });
  });

  describe('location pills', () => {
    it('marks the active location pill with "on" class', () => {
      const wrapper = mountFilterBar({ activeLoc: ParameterLocation.QUERY });
      const locGroup = wrapper.findAll('.inv-filter-group')[0];
      const pills = locGroup.findAll('.inv-pill');
      const queryPill = pills.find(p => p.text() === 'Query');
      expect(queryPill?.classes()).toContain('on');
    });

    it('does not mark inactive location pills with "on" class', () => {
      const wrapper = mountFilterBar({ activeLoc: ParameterLocation.QUERY });
      const locGroup = wrapper.findAll('.inv-filter-group')[0];
      const pills = locGroup.findAll('.inv-pill');
      const allPill = pills.find(p => p.text() === 'All');
      expect(allPill?.classes()).not.toContain('on');
    });

    it('emits "update:activeLoc" with correct value when a location pill is clicked', async () => {
      const wrapper = mountFilterBar({ activeLoc: 'all' });
      const locGroup = wrapper.findAll('.inv-filter-group')[0];
      const queryPill = locGroup.findAll('.inv-pill').find(p => p.text() === 'Query');
      await queryPill?.trigger('click');
      expect(wrapper.emitted('update:activeLoc')).toEqual([[ParameterLocation.QUERY]]);
    });

    it('emits "update:activeLoc" with "all" when All pill is clicked', async () => {
      const wrapper = mountFilterBar({ activeLoc: ParameterLocation.JSON });
      const locGroup = wrapper.findAll('.inv-filter-group')[0];
      const allPill = locGroup.findAll('.inv-pill').find(p => p.text() === 'All');
      await allPill?.trigger('click');
      expect(wrapper.emitted('update:activeLoc')).toEqual([['all']]);
    });
  });

  describe('flag pills', () => {
    it('marks active flag pill with "on" class', () => {
      const wrapper = mountFilterBar({ activeFlags: new Set(['sensitive']) });
      const flagGroup = wrapper.findAll('.inv-filter-group')[1];
      const sensitivePill = flagGroup.findAll('.inv-pill').find(p => p.text() === 'sensitive');
      expect(sensitivePill?.classes()).toContain('on');
    });

    it('does not mark inactive flag pills with "on" class', () => {
      const wrapper = mountFilterBar({ activeFlags: new Set(['sensitive']) });
      const flagGroup = wrapper.findAll('.inv-filter-group')[1];
      const authPill = flagGroup.findAll('.inv-pill').find(p => p.text() === 'auth');
      expect(authPill?.classes()).not.toContain('on');
    });

    it('emits "toggle-flag" with flag key when flag pill is clicked', async () => {
      const wrapper = mountFilterBar();
      const flagGroup = wrapper.findAll('.inv-filter-group')[1];
      const authPill = flagGroup.findAll('.inv-pill').find(p => p.text() === 'auth');
      await authPill?.trigger('click');
      expect(wrapper.emitted('toggle-flag')).toEqual([['auth']]);
    });

    it('marks multiple active flags', () => {
      const wrapper = mountFilterBar({ activeFlags: new Set(['auth', 'idor']) });
      const flagGroup = wrapper.findAll('.inv-filter-group')[1];
      const pills = flagGroup.findAll('.inv-pill').filter(p => p.classes().includes('on'));
      expect(pills).toHaveLength(2);
    });
  });

  describe('value type pills', () => {
    it('marks active value type pill with "on" class', () => {
      const wrapper = mountFilterBar({ activeValueTypes: new Set([ValueType.JWT]) });
      const vtGroup = wrapper.findAll('.inv-filter-group')[2];
      const jwtPill = vtGroup.findAll('.inv-pill').find(p => p.text() === 'jwt');
      expect(jwtPill?.classes()).toContain('on');
    });

    it('does not mark inactive value type pills with "on" class', () => {
      const wrapper = mountFilterBar({ activeValueTypes: new Set([ValueType.JWT]) });
      const vtGroup = wrapper.findAll('.inv-filter-group')[2];
      const emailPill = vtGroup.findAll('.inv-pill').find(p => p.text() === 'email');
      expect(emailPill?.classes()).not.toContain('on');
    });

    it('emits "toggle-value-type" with valueType when value type pill is clicked', async () => {
      const wrapper = mountFilterBar();
      const vtGroup = wrapper.findAll('.inv-filter-group')[2];
      const urlPill = vtGroup.findAll('.inv-pill').find(p => p.text() === 'url');
      await urlPill?.trigger('click');
      expect(wrapper.emitted('toggle-value-type')).toEqual([[ValueType.URL]]);
    });
  });

  describe('separator', () => {
    it('renders separators between filter groups', () => {
      const wrapper = mountFilterBar();
      expect(wrapper.findAll('.inv-filter-sep')).toHaveLength(2);
    });
  });
});
