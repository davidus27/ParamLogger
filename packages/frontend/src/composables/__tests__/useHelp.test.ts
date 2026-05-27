import { describe, it, expect, beforeEach } from 'vitest';
import { useHelp } from '../useHelp';
import { HELP_PAGES } from '../../constants/helpPages';

describe('useHelp', () => {
  it('starts with showHelp=false and helpPage=0', () => {
    const { showHelp, helpPage } = useHelp();
    expect(showHelp.value).toBe(false);
    expect(helpPage.value).toBe(0);
  });

  describe('openHelp', () => {
    it('sets showHelp to true', () => {
      const { showHelp, openHelp } = useHelp();
      openHelp();
      expect(showHelp.value).toBe(true);
    });

    it('resets helpPage to 0 when opened', () => {
      const { helpPage, openHelp, helpNext } = useHelp();
      openHelp();
      helpNext();
      expect(helpPage.value).toBe(1);
      openHelp();
      expect(helpPage.value).toBe(0);
    });
  });

  describe('closeHelp', () => {
    it('sets showHelp to false', () => {
      const { showHelp, openHelp, closeHelp } = useHelp();
      openHelp();
      closeHelp();
      expect(showHelp.value).toBe(false);
    });

    it('does not reset the page when closed', () => {
      const { helpPage, openHelp, helpNext, closeHelp } = useHelp();
      openHelp();
      helpNext();
      closeHelp();
      expect(helpPage.value).toBe(1);
    });
  });

  describe('helpNext', () => {
    it('increments helpPage', () => {
      const { helpPage, openHelp, helpNext } = useHelp();
      openHelp();
      helpNext();
      expect(helpPage.value).toBe(1);
    });

    it('does not go past the last page', () => {
      const { helpPage, openHelp, helpNext } = useHelp();
      openHelp();
      const lastPage = HELP_PAGES.length - 1;
      for (let i = 0; i < lastPage + 5; i++) helpNext();
      expect(helpPage.value).toBe(lastPage);
    });

    it('is a no-op when already on the last page', () => {
      const { helpPage, openHelp, helpNext } = useHelp();
      openHelp();
      for (let i = 0; i < HELP_PAGES.length; i++) helpNext();
      helpNext();
      expect(helpPage.value).toBe(HELP_PAGES.length - 1);
    });
  });

  describe('helpPrev', () => {
    it('decrements helpPage', () => {
      const { helpPage, openHelp, helpNext, helpPrev } = useHelp();
      openHelp();
      helpNext();
      helpPrev();
      expect(helpPage.value).toBe(0);
    });

    it('does not go below 0', () => {
      const { helpPage, openHelp, helpPrev } = useHelp();
      openHelp();
      helpPrev();
      helpPrev();
      expect(helpPage.value).toBe(0);
    });
  });

  describe('page navigation round-trip', () => {
    it('next then prev returns to original page', () => {
      const { helpPage, openHelp, helpNext, helpPrev } = useHelp();
      openHelp();
      helpNext();
      helpPrev();
      expect(helpPage.value).toBe(0);
    });

    it('can traverse all pages forward and backward', () => {
      const { helpPage, openHelp, helpNext, helpPrev } = useHelp();
      openHelp();
      for (let i = 0; i < HELP_PAGES.length - 1; i++) helpNext();
      expect(helpPage.value).toBe(HELP_PAGES.length - 1);
      for (let i = 0; i < HELP_PAGES.length - 1; i++) helpPrev();
      expect(helpPage.value).toBe(0);
    });
  });
});
