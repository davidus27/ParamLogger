/**
 * Global keyboard shortcuts management
 */

import { onMounted, onUnmounted, ref } from 'vue';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  condition?: () => boolean; // Optional condition to check before executing
}

const shortcuts = ref<KeyboardShortcut[]>([]);
const isEnabled = ref(true);

export function useKeyboardShortcuts() {
  
  function registerShortcut(shortcut: KeyboardShortcut) {
    shortcuts.value.push(shortcut);
  }
  
  function unregisterShortcut(key: string, modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) {
    const index = shortcuts.value.findIndex(s => 
      s.key === key && 
      s.ctrl === modifiers?.ctrl &&
      s.shift === modifiers?.shift &&
      s.alt === modifiers?.alt &&
      s.meta === modifiers?.meta
    );
    
    if (index > -1) {
      shortcuts.value.splice(index, 1);
    }
  }
  
  function clearShortcuts() {
    shortcuts.value = [];
  }
  
  function enableShortcuts() {
    isEnabled.value = true;
  }
  
  function disableShortcuts() {
    isEnabled.value = false;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (!isEnabled.value) return;
    
    // Don't trigger shortcuts when user is typing in input fields
    const activeElement = document.activeElement;
    const isInputField = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.hasAttribute('contenteditable')
    );
    
    for (const shortcut of shortcuts.value) {
      // Check if condition exists and is met
      if (shortcut.condition && !shortcut.condition()) {
        continue;
      }
      
      // Match key and modifiers
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!event.ctrlKey === !!shortcut.ctrl;
      const shiftMatch = !!event.shiftKey === !!shortcut.shift;
      const altMatch = !!event.altKey === !!shortcut.alt;
      const metaMatch = !!event.metaKey === !!shortcut.meta;
      
      if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
        // Special handling for certain shortcuts that should work even in input fields
        const allowInInputs = shortcut.key === 'Escape' || shortcut.key === '/';
        
        if (isInputField && !allowInInputs) {
          continue;
        }
        
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }
        
        try {
          shortcut.handler(event);
        } catch (error) {
          console.error('Error executing keyboard shortcut:', error);
        }
        
        break; // Only execute the first matching shortcut
      }
    }
  }
  
  function getShortcutString(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.meta) parts.push('Cmd');
    
    parts.push(shortcut.key);
    
    return parts.join(' + ');
  }
  
  function getRegisteredShortcuts(): Array<KeyboardShortcut & { shortcutString: string }> {
    return shortcuts.value.map(shortcut => ({
      ...shortcut,
      shortcutString: getShortcutString(shortcut)
    }));
  }
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
  });
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    clearShortcuts();
  });
  
  return {
    registerShortcut,
    unregisterShortcut,
    clearShortcuts,
    enableShortcuts,
    disableShortcuts,
    getRegisteredShortcuts,
    getShortcutString,
    isEnabled: isEnabled.value
  };
}

// Global shortcuts registry for the entire plugin
export const globalShortcuts = {
  SEARCH_FOCUS: {
    key: '/',
    description: 'Focus search input',
    preventDefault: true
  },
  
  ESCAPE: {
    key: 'Escape',
    description: 'Close drawers/modals and clear search',
    preventDefault: false
  },
  
  HELP: {
    key: '?',
    shift: true,
    description: 'Show keyboard shortcuts help',
    preventDefault: true
  },
  
  EXPORT_WORDLIST: {
    key: 'e',
    ctrl: true,
    description: 'Export wordlist',
    preventDefault: true
  },
  
  REFRESH: {
    key: 'r',
    ctrl: true,
    description: 'Refresh inventory',
    preventDefault: true
  },
  
  CLEAR_FILTERS: {
    key: 'c',
    alt: true,
    description: 'Clear all filters',
    preventDefault: true
  },
  
  TOGGLE_INTERESTING: {
    key: 'i',
    description: 'Toggle interesting parameters filter',
    preventDefault: true
  },
  
  TOGGLE_NEW: {
    key: 'n',
    description: 'Toggle new parameters filter', 
    preventDefault: true
  },
  
  NEXT_PARAMETER: {
    key: 'j',
    description: 'Select next parameter',
    preventDefault: true
  },
  
  PREV_PARAMETER: {
    key: 'k',
    description: 'Select previous parameter',
    preventDefault: true
  },
  
  OPEN_DETAIL: {
    key: 'Enter',
    description: 'Open parameter detail drawer',
    preventDefault: true
  },
  
  COPY_PARAMETER: {
    key: 'c',
    description: 'Copy selected parameter name',
    preventDefault: true
  },
  
  COPY_ENDPOINT: {
    key: 'e',
    description: 'Copy selected parameter endpoint',
    preventDefault: true
  },
  
  TOGGLE_TREE_PANEL: {
    key: 't',
    description: 'Toggle tree panel visibility',
    preventDefault: true
  },
  
  SETTINGS: {
    key: ',',
    ctrl: true,
    description: 'Open settings',
    preventDefault: true
  }
};