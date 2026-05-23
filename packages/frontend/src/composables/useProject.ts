import { ref, type Ref } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, ProjectInfo } from '@param-inventory/shared';

// Caido emits an event with the new project id when the user switches projects
// (or undefined when no project is active).
interface SelectedProjectChangeEvent {
  projectId: string | undefined;
}

// Module-level singleton so any caller of `useProject()` shares the same
// reactive state. Mirrors the pattern used by `useScope()`.
const currentProject: Ref<ProjectInfo> = ref({ projectId: null, projectName: null });

let caido: Caido<InventoryBackendAPI, InventoryBackendEvents> | null = null;
let projectChangeListener: { stop: () => void } | null = null;

export function useProject() {
  async function init(caidoInstance: Caido<InventoryBackendAPI, InventoryBackendEvents>) {
    caido = caidoInstance;

    // Subscribe before doing the initial read so we don't miss a change that
    // happens between the initial fetch and the listener registration.
    try {
      projectChangeListener = caido.projects?.onCurrentProjectChange?.(
        (event: SelectedProjectChangeEvent) => {
          // The frontend SDK only gives us an id; we ask the backend to
          // resolve the human-friendly name (and confirm the id) so the UI
          // can display it.
          void resolveAndSet(event?.projectId ?? null);
        },
      ) ?? null;

      if (!projectChangeListener) {
        console.warn(
          '[Param Inventory] projects.onCurrentProjectChange is not available on this Caido version; project changes will not refresh the view.',
        );
      } else {
        console.info('[Param Inventory] project listener installed');
      }
    } catch (error) {
      console.warn('[Param Inventory] Failed to subscribe to project changes:', error);
    }

    // Pull the initial project from the backend RPC. The frontend SDK doesn't
    // expose `getCurrentProject`, so the backend (which has access to it via
    // `sdk.projects.getCurrent()`) is the source of truth.
    try {
      const initial = await caido.backend.getCurrentProject();
      currentProject.value = initial;
      console.info('[Param Inventory] initial project =', initial);
    } catch (error) {
      console.warn('[Param Inventory] Failed to read initial project from backend:', error);
      currentProject.value = { projectId: null, projectName: null };
    }
  }

  // Fetch project info from the backend whenever the id changes. The id alone
  // isn't enough for the UI — we also want the name.
  async function resolveAndSet(projectId: string | null) {
    // Optimistically clear the name so any UI that shows it doesn't display a
    // stale value while the lookup is in flight.
    currentProject.value = { projectId, projectName: null };

    if (!caido) return;

    try {
      const info = await caido.backend.getCurrentProject();
      currentProject.value = info;
      console.info('[Param Inventory] project changed →', info);
    } catch (error) {
      console.warn('[Param Inventory] Failed to resolve project info:', error);
    }
  }

  // Allow the backend's authoritative `project-changed` event to update us
  // directly — bypasses the extra RPC round-trip.
  function setFromBackendEvent(info: ProjectInfo) {
    currentProject.value = info;
    console.info('[Param Inventory] project (from backend event) →', info);
  }

  function cleanup() {
    projectChangeListener?.stop();
    projectChangeListener = null;
    caido = null;
  }

  return {
    currentProject,
    init,
    setFromBackendEvent,
    cleanup,
  };
}
