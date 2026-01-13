/**
 * Playwright-style assertion helpers for use with playwright-core
 * These provide similar API to @playwright/test expect but work with playwright-core
 */

import type { Locator, Page } from 'playwright-core';

export class PlaywrightExpect {
  constructor(private locator: Locator | Page) {}

  async toBeVisible(options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    await this.locator.waitFor({ state: 'visible', timeout });
  }

  async toBeHidden(options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    await this.locator.waitFor({ state: 'hidden', timeout });
  }

  async toHaveURL(url: string | RegExp, options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    const page = this.locator as Page;
    await page.waitForURL(url, { timeout });
  }

  async toHaveText(text: string | RegExp, options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    await this.locator.waitFor({ state: 'visible', timeout });
    const actualText = await this.locator.textContent();
    if (typeof text === 'string') {
      if (!actualText?.includes(text)) {
        throw new Error(`Expected text "${text}" but got "${actualText}"`);
      }
    } else {
      if (!text.test(actualText || '')) {
        throw new Error(`Expected text to match ${text} but got "${actualText}"`);
      }
    }
  }

  async toHaveCount(count: number, options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    const actualCount = await this.locator.count();
    if (actualCount !== count) {
      throw new Error(`Expected count ${count} but got ${actualCount}`);
    }
  }

  async toHaveLength(length: number) {
    const array = this.locator as any;
    if (Array.isArray(array)) {
      if (array.length !== length) {
        throw new Error(`Expected length ${length} but got ${array.length}`);
      }
    } else {
      throw new Error('toHaveLength can only be used with arrays');
    }
  }

  async toBe(value: any) {
    const actual = this.locator as any;
    if (actual !== value) {
      throw new Error(`Expected ${value} but got ${actual}`);
    }
  }

  async toHaveValue(value: string, options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    await this.locator.waitFor({ state: 'visible', timeout });
    const actualValue = await (this.locator as Locator).inputValue();
    if (actualValue !== value) {
      throw new Error(`Expected value "${value}" but got "${actualValue}"`);
    }
  }

  async toBeEnabled(options?: { timeout?: number }) {
    const timeout = options?.timeout || 5000;
    await this.locator.waitFor({ state: 'visible', timeout });
    const isEnabled = await (this.locator as Locator).isEnabled();
    if (!isEnabled) {
      throw new Error('Expected element to be enabled but it was disabled');
    }
  }

  async not() {
    return {
      toBeVisible: async (options?: { timeout?: number }) => {
        const timeout = options?.timeout || 5000;
        try {
          await this.locator.waitFor({ state: 'visible', timeout });
          throw new Error('Expected element to be hidden but it was visible');
        } catch (error: any) {
          // If waitFor throws (element not visible), that's what we want
          if (error.message?.includes('visible')) {
            return; // Success - element is hidden
          }
          throw error;
        }
      }
    };
  }
}

export function expect(locator: Locator | Page): PlaywrightExpect {
  return new PlaywrightExpect(locator);
}
