import { describe, it, expect, afterEach, vi } from 'vitest';
import { isRendered, usePageVisibility, PAGE_PATH } from '../usePageVisibility';

type PageListener = (event: { type: 'Plugin' | 'Core'; path: string }) => void;

function fakeCaido({ withHook = true } = {}) {
  const listeners: PageListener[] = [];
  const stopped = vi.fn();
  const navigation = withHook
    ? {
        onPageChange: (cb: PageListener) => {
          listeners.push(cb);
          return {
            stop: () => {
              listeners.splice(listeners.indexOf(cb), 1);
              stopped();
            },
          };
        },
      }
    : {};
  return {
    caido: { navigation } as any,
    listeners,
    stopped,
    go: (path: string) => listeners.forEach((cb) => cb({ type: 'Plugin', path })),
  };
}

function attachedRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  usePageVisibility().stop();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('isRendered', () => {
  it('is false for a detached element', () => {
    expect(isRendered(document.createElement('div'))).toBe(false);
  });

  it('is true for an attached element', () => {
    expect(isRendered(attachedRoot())).toBe(true);
  });

  it('is false under a display:none ancestor', () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'none';
    const root = document.createElement('div');
    wrapper.appendChild(root);
    document.body.appendChild(wrapper);
    expect(isRendered(root)).toBe(false);
  });

  it('ignores opacity, which Caido may animate', () => {
    const root = attachedRoot();
    root.style.opacity = '0';
    expect(isRendered(root)).toBe(true);
  });
});

describe('usePageVisibility', () => {
  it('is visible before tracking starts', () => {
    expect(usePageVisibility().isVisible.value).toBe(true);
  });

  it('starts hidden when the root is detached, as at init()', () => {
    const { isVisible, start } = usePageVisibility();
    start(document.createElement('div'), fakeCaido().caido);
    expect(isVisible.value).toBe(false);
  });

  it('starts visible when the root is already shown', () => {
    const { isVisible, start } = usePageVisibility();
    start(attachedRoot(), fakeCaido().caido);
    expect(isVisible.value).toBe(true);
  });

  it('follows page changes to and away from the plugin page', () => {
    const page = fakeCaido();
    const { isVisible, start } = usePageVisibility();
    start(document.createElement('div'), page.caido);

    page.go(PAGE_PATH);
    expect(isVisible.value).toBe(true);

    page.go('/replay');
    expect(isVisible.value).toBe(false);
  });

  it('stays visible on a page change while the root is shown, whatever the path', () => {
    const page = fakeCaido();
    const { isVisible, start } = usePageVisibility();
    start(attachedRoot(), page.caido);
    page.go('/plugins/param-logger');
    expect(isVisible.value).toBe(true);
  });

  it('treats the page as always visible when the SDK has no onPageChange', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { isVisible, start } = usePageVisibility();
    start(document.createElement('div'), fakeCaido({ withHook: false }).caido);
    expect(isVisible.value).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('re-checks the DOM when the ResizeObserver reports the root', () => {
    const observers: Array<{ cb: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(public cb: () => void) {
          observers.push(this);
        }
      },
    );
    const root = document.createElement('div');
    const { isVisible, start, stop } = usePageVisibility();
    start(root, fakeCaido().caido);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(root);
    expect(isVisible.value).toBe(false);

    document.body.appendChild(root);
    observers[0].cb();
    expect(isVisible.value).toBe(true);

    root.style.display = 'none';
    observers[0].cb();
    expect(isVisible.value).toBe(false);

    stop();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('stop() removes the listener and counts the page as visible again', () => {
    const page = fakeCaido();
    const { isVisible, start, stop } = usePageVisibility();
    start(document.createElement('div'), page.caido);
    stop();
    expect(page.stopped).toHaveBeenCalledTimes(1);
    expect(page.listeners).toHaveLength(0);
    expect(isVisible.value).toBe(true);
  });

  it('a second start() replaces the first listener', () => {
    const page = fakeCaido();
    const { start } = usePageVisibility();
    start(document.createElement('div'), page.caido);
    start(document.createElement('div'), page.caido);
    expect(page.listeners).toHaveLength(1);
  });
});
