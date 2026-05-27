import { ref } from 'vue';
import { HELP_PAGES } from '../constants/helpPages';

export function useHelp() {
  const showHelp = ref(false);
  const helpPage = ref(0);

  function openHelp(): void {
    helpPage.value = 0;
    showHelp.value = true;
  }

  function closeHelp(): void {
    showHelp.value = false;
  }

  function helpNext(): void {
    if (helpPage.value < HELP_PAGES.length - 1) helpPage.value++;
  }

  function helpPrev(): void {
    if (helpPage.value > 0) helpPage.value--;
  }

  return { showHelp, helpPage, openHelp, closeHelp, helpNext, helpPrev };
}
