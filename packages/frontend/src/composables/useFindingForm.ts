import { ref } from 'vue';
import type { Caido } from '@caido/sdk-frontend';
import type { InventoryBackendAPI, InventoryBackendEvents, Parameter } from '@param-logger/shared';

export function useFindingForm() {
  const showFindingForm = ref(false);
  const findingTitle = ref('');
  const findingDescription = ref('');
  const isSavingFinding = ref(false);
  const findingError = ref('');
  const findingSuccess = ref('');
  let findingParamId = '';

  function openFindingForm(p: Parameter): void {
    findingParamId = p.id;
    const flag = p.flags.find(f => f !== 'new');
    const typeHint = flag ? ` (${flag})` : '';
    findingTitle.value = `${p.name}${typeHint} — ${p.method} ${p.normalizedPath}`;
    findingDescription.value = '';
    findingError.value = '';
    findingSuccess.value = '';
    showFindingForm.value = true;
  }

  function cancelFinding(): void {
    showFindingForm.value = false;
    findingError.value = '';
    findingSuccess.value = '';
  }

  function resetFindingForm(): void {
    showFindingForm.value = false;
    findingError.value = '';
    findingSuccess.value = '';
  }

  async function submitFinding(caido: Caido<InventoryBackendAPI, InventoryBackendEvents> | undefined): Promise<void> {
    if (!caido || isSavingFinding.value || !findingTitle.value.trim()) return;
    isSavingFinding.value = true;
    findingError.value = '';
    findingSuccess.value = '';
    try {
      const ids: string[] = await caido.backend.getRequestIdsForParam(findingParamId);
      if (!ids || ids.length === 0) {
        findingError.value = 'No captured request found for this parameter yet. Browse some traffic first.';
        return;
      }
      const requestId = ids[0];
      await caido.findings.createFinding(requestId, {
        title: findingTitle.value.trim(),
        description: findingDescription.value.trim() || undefined,
        reporter: 'Param Logger',
      });
      findingSuccess.value = 'Finding created! View it in the Findings page.';
      setTimeout(() => {
        showFindingForm.value = false;
        findingSuccess.value = '';
      }, 2500);
    } catch (error) {
      console.error('[Param Logger] createFinding failed:', error);
      findingError.value = 'Failed to create finding. See console for details.';
    } finally {
      isSavingFinding.value = false;
    }
  }

  return {
    showFindingForm,
    findingTitle,
    findingDescription,
    isSavingFinding,
    findingError,
    findingSuccess,
    openFindingForm,
    cancelFinding,
    resetFindingForm,
    submitFinding,
  };
}
