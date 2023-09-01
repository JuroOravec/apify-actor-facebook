import type { PlaywrightCrawlerOptions } from 'crawlee';
import { runCrawleeOne, logLevelHandlerWrapper } from 'crawlee-one';

import { createHandlers, routes } from './router';
import { validateInput } from './validation';
import { getPackageJsonInfo } from '../../utils/package';
import type { FbGroupMediaRouteLabel } from './types';
import type { FbGroupMediaActorInput } from './config';
import { closePopupsRouterWrapper } from './pageActions/general';

/** Crawler options that **may** be overriden by user input */
const crawlerConfigDefaults: PlaywrightCrawlerOptions = {
  maxRequestsPerMinute: 120,
  // NOTE: 24-hour timeout. We need high timeout for albums or lists that might have
  // MANY items.
  // During local test, scraper was getting around album 2-4 links per second.
  // If we assume there might be albums with 20k and more photos, that would take 5-6 hrs.
  //
  // Hence, 24 hr timeout should handle up to 85k entries. But assuming that the page will
  // be clogged up with HTML and data at such amounts, maybe those 50-60k entries per single
  // request handler is more sensinble.
  requestHandlerTimeoutSecs: 60 * 60 * 24,
  headless: true,

  // SHOULD I USE THESE?
  // See https://docs.apify.com/academy/expert-scraping-with-apify/solutions/rotating-proxies
  // useSessionPool: true,
  // sessionPoolOptions: {},
};

export const run = async (crawlerConfigOverrides?: PlaywrightCrawlerOptions): Promise<void> => {
  const pkgJson = getPackageJsonInfo(module, ['name']);

  await runCrawleeOne<'playwright', FbGroupMediaRouteLabel, FbGroupMediaActorInput>({
    actorType: 'playwright',
    actorName: pkgJson.name,
    actorConfig: {
      validateInput,
      routes,
      routeHandlers: ({ input }) => createHandlers(input),
      routeHandlerWrappers: ({ input }) => [
        logLevelHandlerWrapper(input?.logLevel ?? 'info'),
        closePopupsRouterWrapper,
      ],
    },
    crawlerConfigDefaults,
    crawlerConfigOverrides,
    onActorReady: async (actor) => {
      await actor.runCrawler();
    },
  }).catch((err) => {
    console.log(err);
    throw err;
  });
};
