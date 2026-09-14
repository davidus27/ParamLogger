import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { isPluginPageActive, useKeyboardShortcuts } from '../useKeyboardShortcuts';

function press(key: string, target: Element = document.body): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  target.dispatchEvent(event);
}

interface Harness {
  wrapper: VueWrapper;
  root: HTMLElement;
  search: HTMLInputElement;
  foreignInput: HTMLInputElement;
  openHelp: ReturnType<typeof vi.fn>;
  closeHelp: ReturnType<typeof vi.fn>;
  closeDrawer: ReturnType<typeof vi.fn>;
  showHelp: { value: boolean };
}

function mountShortcuts(showHelpInitially = false): Harness {
  const openHelp = vi.fn();
  const closeHelp = vi.fn();
  const closeDrawer = vi.fn();
  const showHelp = ref(showHelpInitially);

  const Host = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      const searchInput = ref<HTMLInputElement | null>(null);
      useKeyboardShortcuts({
        root,
        searchInput,
        showHelp,
        openHelp,
        closeHelp,
        closeDrawer,
      });
      return { root, searchInput };
    },
    render() {
      return h('div', [
        h('div', { ref: 'root', class: 'inv-app', id: 'param-logger-root' }, [
          h('input', { ref: 'searchInput', class: 'plugin-search' }),
          h('button', { class: 'plugin-btn' }, 'inside'),
        ]),
        h('input', { class: 'foreign-input' }),
        h('div', { class: 'help-overlay' }, [h('button', { class: 'help-close' }, 'close')]),
      ]);
    },
  });

  const wrapper = mount(Host, { attachTo: document.body });
  return {
    wrapper,
    root: wrapper.find('.inv-app').element as HTMLElement,
    search: wrapper.find('.plugin-search').element as HTMLInputElement,
    foreignInput: wrapper.find('.foreign-input').element as HTMLInputElement,
    openHelp,
    closeHelp,
    closeDrawer,
    showHelp,
  };
}

describe('isPluginPageActive', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns false when root is null', () => {
    expect(isPluginPageActive(null)).toBe(false);
  });

  it('returns false when the root is not in the document', () => {
    const root = document.createElement('div');
    expect(isPluginPageActive(root)).toBe(false);
  });

  it('returns true when the plugin page is attached and visible', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    expect(isPluginPageActive(root)).toBe(true);
  });

  it('returns false when the plugin page is hidden (other Caido page)', () => {
    const root = document.createElement('div');
    root.style.display = 'none';
    document.body.appendChild(root);
    expect(isPluginPageActive(root)).toBe(false);
  });

  it('returns false when an ancestor is hidden', () => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'none';
    const root = document.createElement('div');
    wrapper.appendChild(root);
    document.body.appendChild(wrapper);
    expect(isPluginPageActive(root)).toBe(false);
  });
});

describe('useKeyboardShortcuts', () => {
  let harness: Harness | undefined;

  afterEach(() => {
    harness?.wrapper.unmount();
    harness = undefined;
    document.body.innerHTML = '';
  });

  describe('? help shortcut', () => {
    it('opens help when the plugin page is visible, even if focus is on document.body', () => {
      harness = mountShortcuts();
      document.body.tabIndex = -1;
      document.body.focus();
      press('?', document.body);
      expect(harness.openHelp).toHaveBeenCalledOnce();
    });

    it('opens help when focus is inside the plugin page', () => {
      harness = mountShortcuts();
      harness.wrapper.find('.plugin-btn').element.focus();
      press('?', harness.wrapper.find('.plugin-btn').element);
      expect(harness.openHelp).toHaveBeenCalledOnce();
    });

    it('does not open help when the plugin page is hidden', () => {
      harness = mountShortcuts();
      harness.root.style.display = 'none';
      press('?', document.body);
      expect(harness.openHelp).not.toHaveBeenCalled();
    });

    it('does not open help when focus is in a foreign input', () => {
      harness = mountShortcuts();
      harness.foreignInput.focus();
      press('?', harness.foreignInput);
      expect(harness.openHelp).not.toHaveBeenCalled();
    });

    it('does not open help when typing ? in the plugin search input', () => {
      harness = mountShortcuts();
      harness.search.focus();
      press('?', harness.search);
      expect(harness.openHelp).not.toHaveBeenCalled();
    });

    it('does not open help when focus is in a contenteditable editor', () => {
      harness = mountShortcuts();
      const editor = document.createElement('div');
      editor.contentEditable = 'true';
      document.body.appendChild(editor);
      editor.focus();
      press('?', editor);
      expect(harness.openHelp).not.toHaveBeenCalled();
    });
  });

  describe('/ search shortcut', () => {
    it('focuses the search input when the plugin page is visible', () => {
      harness = mountShortcuts();
      press('/', document.body);
      expect(document.activeElement).toBe(harness.search);
    });

    it('does not steal / when focus is in a foreign input', () => {
      harness = mountShortcuts();
      harness.foreignInput.focus();
      press('/', harness.foreignInput);
      expect(document.activeElement).toBe(harness.foreignInput);
    });
  });

  describe('Escape', () => {
    it('closes the help modal even when help is teleported outside the plugin root', () => {
      harness = mountShortcuts(true);
      harness.wrapper.find('.help-close').element.focus();
      press('Escape', harness.wrapper.find('.help-close').element);
      expect(harness.closeHelp).toHaveBeenCalledOnce();
      expect(harness.closeDrawer).not.toHaveBeenCalled();
    });

    it('closes the drawer when help is closed and the plugin page is visible', () => {
      harness = mountShortcuts();
      press('Escape', document.body);
      expect(harness.closeDrawer).toHaveBeenCalledOnce();
    });

    it('does not close the drawer when the plugin page is hidden', () => {
      harness = mountShortcuts();
      harness.root.style.display = 'none';
      press('Escape', document.body);
      expect(harness.closeDrawer).not.toHaveBeenCalled();
    });
  });
});
