import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType } from '@param-logger/shared';
import { useSelection } from '../useSelection';

function makeParam(overrides: Partial<Parameter> = {}): Parameter {
  return {
    id: 'p1',
    domain: 'example.com',
    method: 'GET',
    normalizedPath: '/api/test',
    location: ParameterLocation.QUERY,
    name: 'q',
    valueTypes: [],
    flags: [],
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

describe('useSelection', () => {
  describe('initial state', () => {
    it('selectedScope is null', () => {
      const { selectedScope } = useSelection();
      expect(selectedScope.value).toBeNull();
    });

    it('selectedParam is null', () => {
      const { selectedParam } = useSelection();
      expect(selectedParam.value).toBeNull();
    });

    it('openDomains is empty', () => {
      const { openDomains } = useSelection();
      expect(openDomains.size).toBe(0);
    });
  });

  describe('selectScope', () => {
    it('sets selectedScope to a domain object', () => {
      const { selectedScope, selectScope } = useSelection();
      selectScope({ domain: 'example.com' });
      expect(selectedScope.value).toEqual({ domain: 'example.com' });
    });

    it('sets selectedScope to null', () => {
      const { selectedScope, selectScope } = useSelection();
      selectScope({ domain: 'example.com' });
      selectScope(null);
      expect(selectedScope.value).toBeNull();
    });

    it('sets selectedScope with method and path', () => {
      const { selectedScope, selectScope } = useSelection();
      selectScope({ domain: 'example.com', method: 'POST', path: '/api/users' });
      expect(selectedScope.value).toEqual({ domain: 'example.com', method: 'POST', path: '/api/users' });
    });
  });

  describe('isDomainSelected', () => {
    it('returns false when no scope selected', () => {
      const { isDomainSelected } = useSelection();
      expect(isDomainSelected('example.com')).toBe(false);
    });

    it('returns true when domain matches and no path set', () => {
      const { isDomainSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com' });
      expect(isDomainSelected('example.com')).toBe(true);
    });

    it('returns false for a different domain', () => {
      const { isDomainSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com' });
      expect(isDomainSelected('other.com')).toBe(false);
    });

    it('returns false when scope has a path (endpoint selection, not domain)', () => {
      const { isDomainSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com', path: '/api', method: 'GET' });
      expect(isDomainSelected('example.com')).toBe(false);
    });
  });

  describe('isEndpointSelected', () => {
    it('returns false when no scope selected', () => {
      const { isEndpointSelected } = useSelection();
      expect(isEndpointSelected('example.com', 'GET', '/api')).toBe(false);
    });

    it('returns true for exact domain+method+path match', () => {
      const { isEndpointSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com', method: 'GET', path: '/api' });
      expect(isEndpointSelected('example.com', 'GET', '/api')).toBe(true);
    });

    it('returns false when only domain matches', () => {
      const { isEndpointSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com', method: 'GET', path: '/api' });
      expect(isEndpointSelected('example.com', 'POST', '/api')).toBe(false);
    });

    it('returns false when path differs', () => {
      const { isEndpointSelected, selectScope } = useSelection();
      selectScope({ domain: 'example.com', method: 'GET', path: '/api' });
      expect(isEndpointSelected('example.com', 'GET', '/other')).toBe(false);
    });
  });

  describe('toggleDomain', () => {
    it('adds the domain to openDomains on first toggle', () => {
      const { openDomains, toggleDomain } = useSelection();
      toggleDomain('example.com');
      expect(openDomains.has('example.com')).toBe(true);
    });

    it('removes the domain on second toggle', () => {
      const { openDomains, toggleDomain } = useSelection();
      toggleDomain('example.com');
      toggleDomain('example.com');
      expect(openDomains.has('example.com')).toBe(false);
    });

    it('also calls selectScope with the domain', () => {
      const { selectedScope, toggleDomain } = useSelection();
      toggleDomain('example.com');
      expect(selectedScope.value).toEqual({ domain: 'example.com' });
    });

    it('can open multiple domains independently', () => {
      const { openDomains, toggleDomain } = useSelection();
      toggleDomain('a.com');
      toggleDomain('b.com');
      expect(openDomains.has('a.com')).toBe(true);
      expect(openDomains.has('b.com')).toBe(true);
    });
  });

  describe('collapseAll', () => {
    it('removes all open domains', () => {
      const { openDomains, toggleDomain, collapseAll } = useSelection();
      toggleDomain('a.com');
      toggleDomain('b.com');
      collapseAll();
      expect(openDomains.size).toBe(0);
    });
  });

  describe('expandAll', () => {
    it('opens all domains returned by getFilteredTree', () => {
      const tree = [{ name: 'a.com' }, { name: 'b.com' }];
      const { openDomains, expandAll } = useSelection({ getFilteredTree: () => tree });
      expandAll();
      expect(openDomains.has('a.com')).toBe(true);
      expect(openDomains.has('b.com')).toBe(true);
    });

    it('opens nothing when getFilteredTree is not provided', () => {
      const { openDomains, expandAll } = useSelection();
      expandAll();
      expect(openDomains.size).toBe(0);
    });

    it('opens nothing when getFilteredTree returns empty array', () => {
      const { openDomains, expandAll } = useSelection({ getFilteredTree: () => [] });
      expandAll();
      expect(openDomains.size).toBe(0);
    });
  });

  describe('openDrawer', () => {
    it('sets selectedParam', () => {
      const { selectedParam, openDrawer } = useSelection();
      const p = makeParam();
      openDrawer(p);
      expect(selectedParam.value).toBe(p);
    });

    it('calls onParamChange when switching to a different parameter', () => {
      const onParamChange = vi.fn();
      const { openDrawer } = useSelection({ onParamChange });
      const p1 = makeParam({ id: 'p1' });
      const p2 = makeParam({ id: 'p2' });
      // First open triggers onParamChange (selectedParam was null, null?.id !== p1.id).
      // Second open also triggers it because p1.id !== p2.id.
      openDrawer(p1);
      openDrawer(p2);
      expect(onParamChange).toHaveBeenCalledTimes(2);
    });

    it('does not call onParamChange when opening the same parameter again', () => {
      const onParamChange = vi.fn();
      const { openDrawer } = useSelection({ onParamChange });
      const p = makeParam({ id: 'p1' });
      // First open triggers because selectedParam was null.
      openDrawer(p);
      // Second open with the same param: id matches, so onParamChange is NOT called again.
      openDrawer(p);
      expect(onParamChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeDrawer', () => {
    it('sets selectedParam to null', () => {
      const { selectedParam, openDrawer, closeDrawer } = useSelection();
      openDrawer(makeParam());
      closeDrawer();
      expect(selectedParam.value).toBeNull();
    });

    it('calls onDrawerClose callback', () => {
      const onDrawerClose = vi.fn();
      const { openDrawer, closeDrawer } = useSelection({ onDrawerClose });
      openDrawer(makeParam());
      closeDrawer();
      expect(onDrawerClose).toHaveBeenCalledTimes(1);
    });

    it('does not throw when called without a prior openDrawer', () => {
      const { closeDrawer } = useSelection();
      expect(() => closeDrawer()).not.toThrow();
    });
  });
});
