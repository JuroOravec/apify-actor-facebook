import type { CrawleeOneRouteWrapper } from 'crawlee-one';
import type { JSHandle, Page } from 'playwright';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { FbGroupMediaRouterContext } from '../types';

///////////////////////
// PAGE ACIONS
///////////////////////

export const generalPageActions = {
  searchFbPayloads: async (
    page: Page,
    filter: JSHandle<(d: any) => any>,
    options?: {
      selector?: string;
      prefilter?: JSHandle<(el: Element) => any>;
    }
  ) => {
    const selector = options?.selector ?? 'script';
    const prefilter =
      options?.prefilter ??
      (await page.evaluateHandle(() => {
        return (el) => el.textContent && el.textContent.includes('result');
      }));

    const matchedPayloads = page.evaluate(
      ({ selector, prefilter, filter }) => {
        // Function that walks down a data structure, collecting values that
        // match the filter function.
        const walkFilter = (d: any, filterFn: (d: any) => any) => {
          const queue = [d];
          const results: any[] = [];

          const innerWalkFind = (innerD: any) => {
            if (filterFn(innerD)) results.push(innerD);

            if (Array.isArray(innerD)) {
              innerD.forEach((item) => queue.unshift(item));
            } else if (innerD != null && typeof innerD === 'object') {
              Object.values(innerD).forEach((val) => queue.unshift(val));
            }
          };

          while (queue.length) {
            const currItem = queue.shift();
            innerWalkFind(currItem);
          }
          return results;
        };

        const scriptCandidates = [...document.querySelectorAll(selector)]
          .filter(prefilter)
          .map((el) => {
            if (!el.textContent) return null;
            try {
              return JSON.parse(el.textContent);
            } catch (e) {
              return eval(el.textContent);
            }
          });

        return walkFilter(scriptCandidates, filter);
      },
      { selector, prefilter, filter }
    );

    return matchedPayloads;
  },

  pingForAndClosePopups: (page: Page, freq = 1000) => {
    const popups = [
      { name: 'Cookie consent popup', selector: '[aria-label*="cookie" i][role="button" i]:not([aria-disabled])' },
      { name: 'Login dialog', selector: '[role="dialog" i] [aria-label="close" i][role="button" i]' },
    ].map((d) => ({ ...d, locator: page.locator(d.selector) })); // prettier-ignore

    const intervalId = setInterval(async () => {
      if (!page || page.isClosed()) {
        clearInterval(intervalId);
        return;
      }
      for (const { name, locator } of popups) {
        // console.log(`Checking for presence of "${name}"`);
        try {
          const elIsPresent = await locator.count();
          if (!elIsPresent) continue;
          // Click on button to dismiss the dialog
          console.log(`Dismissing "${name}"`);
          const dialogLoc = locator.first();
          await dialogLoc.scrollIntoViewIfNeeded();
          await dialogLoc.click({ force: true });
        } catch (err) {
          console.error(err);
        }
      }
    }, freq);

    const dispose = () => clearInterval(intervalId);
    return dispose;
  },
};

export const closePopupsRouterWrapper: CrawleeOneRouteWrapper<
  PlaywrightCrawlingContext<any>,
  FbGroupMediaRouterContext
> = (origRouterHandler) => {
  return (ctx, ...args) => {
    generalPageActions.pingForAndClosePopups(ctx.page);
    return origRouterHandler(ctx, ...args);
  };
};

///////////////////////
// DOM ACIONS
///////////////////////

// export const generalDOMActions = {};

///////////////////////
// HELPERS
///////////////////////

// export const generalPageMethods = {};
