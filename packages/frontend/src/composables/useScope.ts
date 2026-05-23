import { ref, type Ref } from 'vue';
import type { Caido } from '@caido/sdk-frontend';

// Scope shape as exposed by the Caido SDK.
interface Scope {
  id: string;
  name: string;
  allowlist: string[];
  denylist: string[];
}

// Module-level singleton so multiple call sites share the same reactive state.
const currentScope: Ref<Scope | undefined> = ref(undefined);

let caido: Caido | null = null;
let scopeChangeListener: { stop: () => void } | null = null;
let projectChangeListener: { stop: () => void } | null = null;

// Read whatever scope Caido currently reports as active. Returns `undefined`
// when the SDK isn't yet ready or the user has no scope selected.
function readCurrentScope(): Scope | undefined {
  if (!caido?.scopes?.getCurrentScope) return undefined;
  try {
    return caido.scopes.getCurrentScope() as Scope | undefined;
  } catch (error) {
    console.warn('[Param Inventory] Failed to read current scope:', error);
    return undefined;
  }
}

export function useScope() {

  // Re-read the active scope from Caido and update our reactive ref.
  // Useful when the project changes — scopes are project-scoped, so the
  // previously-selected scope id is no longer meaningful in the new project.
  function refresh(reason: string = 'manual'): Scope | undefined {
    const next = readCurrentScope();
    const prev = currentScope.value;
    currentScope.value = next;
    // Only log when the scope identity actually changed, to avoid spamming
    // the console during the project-change retry burst (which fires the
    // refresh up to three times in 500ms).
    if (prev?.id !== next?.id) {
      console.info(`[Param Inventory] scope refreshed (${reason}) →`, next);
    }
    return next;
  }

  async function init(caidoInstance: Caido) {
    caido = caidoInstance;

    if (!caido.scopes) {
      console.warn('[Param Inventory] Caido SDK does not expose scopes API; scope filtering disabled.');
      currentScope.value = undefined;
      return;
    }

    // Register the listener first so we don't miss any updates that happen
    // between reading the initial scope and subscribing.
    try {
      scopeChangeListener = caido.scopes.onCurrentScopeChange?.(
        () => {
          // The event payload only carries the scope id, but the SDK also
          // exposes `getCurrentScope()` which returns the full scope object
          // and is race-free with project transitions (whereas
          // `getScopes()` + id lookup can briefly return the previous
          // project's scope set). Always trust `getCurrentScope()`.
          refresh('scope-change-event');
        }
      ) ?? null;

      if (!scopeChangeListener) {
        console.warn('[Param Inventory] scopes.onCurrentScopeChange is not available on this Caido version; scope changes will not refresh the view.');
      } else {
        console.info('[Param Inventory] scope listener installed');
      }
    } catch (error) {
      console.warn('[Param Inventory] Failed to subscribe to scope changes:', error);
    }

    // Scopes are project-scoped, so we ALSO listen for project changes here:
    // when Caido switches projects, the active scope changes too, but Caido
    // doesn't always fire `onCurrentScopeChange` for the new project's
    // default scope. We re-read it ourselves to guarantee the filter stays
    // in sync with the active project.
    try {
      projectChangeListener = caido.projects?.onCurrentProjectChange?.(
        () => {
          // Refresh immediately so the UI label updates fast, then again
          // shortly after to cover the case where Caido's scope state for
          // the new project hadn't been published yet at the time the
          // project change event fired.
          refresh('project-change-event');
          setTimeout(() => refresh('project-change-event-retry-100ms'), 100);
          setTimeout(() => refresh('project-change-event-retry-500ms'), 500);
        }
      ) ?? null;

      if (projectChangeListener) {
        console.info('[Param Inventory] scope: project listener installed');
      }
    } catch (error) {
      console.warn('[Param Inventory] Failed to subscribe to project changes for scope refresh:', error);
    }

    // `getCurrentScope()` returns the Scope object itself (not an id).
    refresh('init');
  }

  // Normalize a host or pattern for matching: strip scheme/port, lowercase
  function normalizeHost(value: string): string {
    let normalized = value;
    
    // Strip leading scheme (https?://)
    normalized = normalized.replace(/^https?:\/\//, '');
    
    // Drop everything from the first '/' onward
    normalized = normalized.split('/')[0];
    
    // Strip port suffix
    normalized = normalized.split(':')[0];
    
    // Lowercase
    normalized = normalized.toLowerCase();
    
    return normalized;
  }

  // Convert a Caido scope pattern to a regex
  function patternToRegex(pattern: string): RegExp {
    // Normalize the pattern first
    const normalized = normalizeHost(pattern);
    
    // Escape regex metacharacters except * and ?
    // Use placeholders to avoid double-conversion
    const withPlaceholders = normalized
      .replace(/\*/g, '__ASTERISK__')
      .replace(/\?/g, '__QUESTION__');
    
    const escaped = withPlaceholders.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Replace placeholders with regex equivalents
    const regexPattern = escaped
      .replace(/__ASTERISK__/g, '.*')
      .replace(/__QUESTION__/g, '.');
    
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  function isHostInScope(host: string): boolean {
    const scope = currentScope.value;
    // No scope selected → everything is in scope (mirrors Caido's behaviour).
    if (!scope) return true;

    const { allowlist, denylist } = scope;
    const normalizedHost = normalizeHost(host);

    // Check denylist first
    for (const denyPattern of denylist) {
      if (patternToRegex(denyPattern).test(normalizedHost)) {
        return false;
      }
    }

    // If allowlist is empty, allow everything (that wasn't denied)
    if (allowlist.length === 0) {
      return true;
    }

    // Check allowlist
    for (const allowPattern of allowlist) {
      if (patternToRegex(allowPattern).test(normalizedHost)) {
        return true;
      }
    }

    return false;
  }

  // Developer-facing helper for debugging scope matching
  function explain(host: string): { inScope: boolean; reason: string; scope?: Scope } {
    const scope = currentScope.value;
    const normalizedHost = normalizeHost(host);
    
    if (!scope) {
      return {
        inScope: true,
        reason: 'No scope selected - all hosts allowed',
      };
    }

    const { allowlist, denylist } = scope;

    // Check denylist first
    for (const denyPattern of denylist) {
      if (patternToRegex(denyPattern).test(normalizedHost)) {
        return {
          inScope: false,
          reason: `Blocked by denylist pattern: ${denyPattern}`,
          scope,
        };
      }
    }

    // If allowlist is empty, allow everything (that wasn't denied)
    if (allowlist.length === 0) {
      return {
        inScope: true,
        reason: 'Allowlist is empty - all hosts allowed (except denied)',
        scope,
      };
    }

    // Check allowlist
    for (const allowPattern of allowlist) {
      if (patternToRegex(allowPattern).test(normalizedHost)) {
        return {
          inScope: true,
          reason: `Matched allowlist pattern: ${allowPattern}`,
          scope,
        };
      }
    }

    return {
      inScope: false,
      reason: `No allowlist pattern matched. Normalized host: ${normalizedHost}`,
      scope,
    };
  }

  function cleanup() {
    scopeChangeListener?.stop();
    scopeChangeListener = null;
    projectChangeListener?.stop();
    projectChangeListener = null;
    caido = null;
  }

  function getCurrentScope() {
    return currentScope.value;
  }

  return {
    currentScope: currentScope,
    init,
    refresh,
    isHostInScope,
    explain,
    getCurrentScope,
    cleanup
  };
}
