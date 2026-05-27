import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Parameter } from '@param-logger/shared';
import { ParameterLocation, ValueType, Flag } from '@param-logger/shared';
import { useFindingForm } from '../useFindingForm';

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
    count: 1,
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

function makeCaido(overrides: Record<string, unknown> = {}) {
  return {
    backend: {
      getRequestIdsForParam: vi.fn().mockResolvedValue(['req-1']),
      ...overrides.backend,
    },
    findings: {
      createFinding: vi.fn().mockResolvedValue(undefined),
      ...overrides.findings,
    },
    ...overrides,
  } as any;
}

describe('useFindingForm', () => {
  describe('initial state', () => {
    it('showFindingForm is false', () => {
      const { showFindingForm } = useFindingForm();
      expect(showFindingForm.value).toBe(false);
    });

    it('isSavingFinding is false', () => {
      const { isSavingFinding } = useFindingForm();
      expect(isSavingFinding.value).toBe(false);
    });

    it('findingTitle is empty', () => {
      const { findingTitle } = useFindingForm();
      expect(findingTitle.value).toBe('');
    });

    it('findingDescription is empty', () => {
      const { findingDescription } = useFindingForm();
      expect(findingDescription.value).toBe('');
    });

    it('findingError is empty', () => {
      const { findingError } = useFindingForm();
      expect(findingError.value).toBe('');
    });

    it('findingSuccess is empty', () => {
      const { findingSuccess } = useFindingForm();
      expect(findingSuccess.value).toBe('');
    });
  });

  describe('openFindingForm', () => {
    it('sets showFindingForm to true', () => {
      const { showFindingForm, openFindingForm } = useFindingForm();
      openFindingForm(makeParam());
      expect(showFindingForm.value).toBe(true);
    });

    it('builds a title from param name + method + path (no flags)', () => {
      const { findingTitle, openFindingForm } = useFindingForm();
      const p = makeParam({ name: 'userId', method: 'GET', normalizedPath: '/api/users', flags: [] });
      openFindingForm(p);
      expect(findingTitle.value).toBe('userId — GET /api/users');
    });

    it('includes the first non-new flag in the title', () => {
      const { findingTitle, openFindingForm } = useFindingForm();
      const p = makeParam({ name: 'redirect', flags: [Flag.NEW, Flag.REDIRECT] });
      openFindingForm(p);
      expect(findingTitle.value).toBe('redirect (redirect) — GET /api/users');
    });

    it('skips the "new" flag when building the title hint', () => {
      const { findingTitle, openFindingForm } = useFindingForm();
      const p = makeParam({ name: 'myParam', flags: [Flag.NEW] });
      openFindingForm(p);
      expect(findingTitle.value).toBe('myParam — GET /api/users');
    });

    it('uses the first non-new flag when multiple flags present', () => {
      const { findingTitle, openFindingForm } = useFindingForm();
      const p = makeParam({ name: 'token', flags: [Flag.AUTH, Flag.SENSITIVE] });
      openFindingForm(p);
      expect(findingTitle.value).toBe('token (auth) — GET /api/users');
    });

    it('clears description, error, and success on open', () => {
      const { findingDescription, findingError, findingSuccess, openFindingForm } = useFindingForm();
      findingDescription.value = 'old desc';
      findingError.value = 'old error';
      findingSuccess.value = 'old success';
      openFindingForm(makeParam());
      expect(findingDescription.value).toBe('');
      expect(findingError.value).toBe('');
      expect(findingSuccess.value).toBe('');
    });
  });

  describe('cancelFinding', () => {
    it('sets showFindingForm to false', () => {
      const { showFindingForm, openFindingForm, cancelFinding } = useFindingForm();
      openFindingForm(makeParam());
      cancelFinding();
      expect(showFindingForm.value).toBe(false);
    });

    it('clears error and success', () => {
      const { findingError, findingSuccess, openFindingForm, cancelFinding } = useFindingForm();
      openFindingForm(makeParam());
      findingError.value = 'some error';
      findingSuccess.value = 'some success';
      cancelFinding();
      expect(findingError.value).toBe('');
      expect(findingSuccess.value).toBe('');
    });
  });

  describe('resetFindingForm', () => {
    it('sets showFindingForm to false', () => {
      const { showFindingForm, openFindingForm, resetFindingForm } = useFindingForm();
      openFindingForm(makeParam());
      resetFindingForm();
      expect(showFindingForm.value).toBe(false);
    });

    it('clears error and success', () => {
      const { findingError, findingSuccess, openFindingForm, resetFindingForm } = useFindingForm();
      openFindingForm(makeParam());
      findingError.value = 'err';
      findingSuccess.value = 'ok';
      resetFindingForm();
      expect(findingError.value).toBe('');
      expect(findingSuccess.value).toBe('');
    });
  });

  describe('submitFinding', () => {
    it('does nothing when caido is undefined', async () => {
      const { openFindingForm, submitFinding, isSavingFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(undefined);
      expect(isSavingFinding.value).toBe(false);
    });

    it('does nothing when title is empty', async () => {
      const caido = makeCaido();
      const { openFindingForm, submitFinding, findingTitle, isSavingFinding } = useFindingForm();
      openFindingForm(makeParam());
      findingTitle.value = '   ';
      await submitFinding(caido);
      expect(isSavingFinding.value).toBe(false);
      expect(caido.backend.getRequestIdsForParam).not.toHaveBeenCalled();
    });

    it('sets error when no request IDs found', async () => {
      const caido = makeCaido({
        backend: { getRequestIdsForParam: vi.fn().mockResolvedValue([]) },
      });
      const { findingError, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(findingError.value).toContain('No captured request');
    });

    it('sets error when getRequestIdsForParam returns null', async () => {
      const caido = makeCaido({
        backend: { getRequestIdsForParam: vi.fn().mockResolvedValue(null) },
      });
      const { findingError, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(findingError.value).toContain('No captured request');
    });

    it('calls createFinding with correct arguments on happy path', async () => {
      const caido = makeCaido();
      const { openFindingForm, submitFinding } = useFindingForm();
      const p = makeParam({ name: 'csrf', flags: [] });
      openFindingForm(p);
      await submitFinding(caido);
      expect(caido.findings.createFinding).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          title: expect.stringContaining('csrf'),
          reporter: 'Param Logger',
        }),
      );
    });

    it('sets findingSuccess on happy path', async () => {
      const caido = makeCaido();
      const { findingSuccess, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(findingSuccess.value).toContain('Finding created');
    });

    it('auto-closes the form after success (fake timers)', async () => {
      vi.useFakeTimers();
      const caido = makeCaido();
      const { showFindingForm, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(showFindingForm.value).toBe(true);
      vi.advanceTimersByTime(2500);
      expect(showFindingForm.value).toBe(false);
      vi.useRealTimers();
    });

    it('sets findingError when createFinding throws', async () => {
      const caido = makeCaido({
        findings: { createFinding: vi.fn().mockRejectedValue(new Error('API failure')) },
      });
      const { findingError, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(findingError.value).toContain('Failed to create finding');
    });

    it('resets isSavingFinding to false after success', async () => {
      const caido = makeCaido();
      const { isSavingFinding, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(isSavingFinding.value).toBe(false);
    });

    it('resets isSavingFinding to false after error', async () => {
      const caido = makeCaido({
        findings: { createFinding: vi.fn().mockRejectedValue(new Error('fail')) },
      });
      const { isSavingFinding, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      await submitFinding(caido);
      expect(isSavingFinding.value).toBe(false);
    });

    it('does not submit concurrently (guard: isSavingFinding)', async () => {
      let resolveFirst!: () => void;
      const firstCall = new Promise<void>(res => { resolveFirst = res; });
      const caido = makeCaido({
        backend: {
          getRequestIdsForParam: vi.fn().mockImplementation(() => firstCall.then(() => ['req-1'])),
        },
      });
      const { isSavingFinding, openFindingForm, submitFinding } = useFindingForm();
      openFindingForm(makeParam());
      const first = submitFinding(caido);
      // Second call should be ignored while first is in flight.
      await submitFinding(caido);
      expect(caido.backend.getRequestIdsForParam).toHaveBeenCalledTimes(1);
      resolveFirst();
      await first;
    });
  });
});
