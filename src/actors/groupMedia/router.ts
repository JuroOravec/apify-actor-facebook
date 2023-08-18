import type { Log, PlaywrightCrawlingContext } from 'crawlee';
import {
  type RouteHandler,
  type RouteMatcher,
  type DOMLib,
  cheerioDOMLib,
  playwrightDOMLib,
  playwrightPageLib,
  type CrawlerRouterWrapper,
} from 'apify-actor-utils';
import { Actor } from 'apify';
import type { ElementHandle, JSHandle, Page } from 'playwright';
import { parse as parseDate, format as formatDate } from 'date-fns';

import type {
  FbAlbumPostEntry,
  FbGroupMediaRouteLabel,
  FbGroupMediaRouterContext,
  FbPhotoPostEntry,
  FbVideoPostEntry,
  PostStats,
} from './types';
import type { FbGroupMediaActorInput } from './config';
import { getSearchParams, removeSearchParams } from '../../utils/url';
import { serialAsyncFind, serialAsyncMap, wait } from '../../utils/async';
import { getImageMetaFromUrl, imageMeta } from '../../utils/image';
import type { MaybeArrayItems } from '../../utils/types';

// NOTE: Complex regexes are defined in top-level scope, so any syntax errors within them
//       are captured during initialization.
const REGEX = {
  // Check that URL path starts with /groups/<GROUP_ID>
  // E.g. https://www.facebook.com/groups/185350018231892
  FB_GROUP_URL: /^\/groups\/(?<groupId>[a-z0-9]+)(?:$|\/)/i,

  // Check that URL path starts with /groups/<GROUP_ID>/media
  // E.g. https://www.facebook.com/groups/185350018231892/media
  FB_GROUP_MEDIA_URL: /^\/groups\/(?<groupId>[a-z0-9]+)\/media\/?$/i,

  // Check that URL path starts with /groups/<GROUP_ID>/media
  // E.g. https://www.facebook.com/groups/185350018231892/media
  FB_GROUP_MEDIA_TAB_URL: /^\/groups\/(?<groupId>[a-z0-9]+)\/media\/(?<tab>[a-z0-9]+)\/?$/i,

  // Check that URL path starts with /media/set
  // E.g. https://www.facebook.com/media/set/?set=oa.187284474705113
  FB_ALBUM_URL: /^\/media\/set(?:$|\/)/i,

  // Check that URL path starts with /photo
  // E.g. https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
  FB_PHOTO_URL: /^\/photo(?:$|\/)/i,

  // Check that URL path starts with /<USER_ID>/videos/<VIDEO_ID>
  // E.g. https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
  FB_VIDEO_URL: /^\/(?<userId>[\w.-]+)\/videos\/(?<videoId>[a-z0-9]+)(?:$|\/)/i,

  // Match text like "June 24, 2013"
  TIMESTAMP_DATE: /[a-z]+\s+\d{1,2}[,\s]+\d+/i,

  // Match individual terms of text "Monday, June 24, 2013 at 5:20 PM"
  TIMESTAMP_DATETIME:
    /^(?<day>[a-z]+)[\s,]+(?<month>[a-z]+)[\s,]+(?<dayOfMonth>\d+)[\s,]+(?<year>\d+)[\D\s,]+(?<hour>\d+)[\s:]+(?<minute>\d+)[\s,]+(?<timeOfDay>[a-z]+)/i,

  // Match text "7 comments" or "7,000 comments"
  COMMENT_COUNT: /(?<comments>[\d,.]+)(?:\s+comment)?/i,

  // Match text "Like: 26" or "Like: 2,600"
  LIKE_COUNT: /like.*?(?<likes>[\d,.]+)/i,

  // Match text "6.9K views"
  VIEW_COUNT: /(?<views>[\d,.]+)\s*(?<viewsUnit>[kmb])/i,
};

const getPostTimestampLoc = async (page: Page) => {
  const timestampLoc = page
    .locator('[aria-label]') // Matches about 20 els
    // Match text like "June 24, 2013"
    .filter({ hasText: REGEX.TIMESTAMP_DATE })
    .first();
  return timestampLoc;
};
const getPostTimestampEl = async <T extends unknown>(dom: DOMLib<T, any>) => {
  const ariaEls = await dom.findMany('[aria-label]'); // Matches about 20 els
  const timestampEl = await serialAsyncFind(ariaEls, async (el) => {
    const text = await el.text();
    // Match text like "June 24, 2013"
    return text?.match(REGEX.TIMESTAMP_DATE);
  });
  return timestampEl ?? null;
};

// Browser-specific - Page Action
const getPostTimestampValue = async (page: Page, parentLogger?: Log) => {
  const logger = parentLogger?.child({ prefix: 'getPostTimestamp_' });

  // 1. Hover over the date of posting to reveal a tooltip with more detailed timestamp
  logger?.debug('001: Finding timestamp element.');
  const timestampLoc = await getPostTimestampLoc(page);
  logger?.debug('002": Hovering the timestamp element.');
  await timestampLoc.hover({ force: true }); // https://stackoverflow.com/a/73610985

  // 2. Extract the timestmap from the tooltip
  logger?.debug('003": Waiting for tooltip with detailed timestamp.');
  const tooltipLoc = page.locator('[role="tooltip"]');
  await tooltipLoc.waitFor();
  // We get something like "Monday, June 24, 2013 at 5:20 PM"
  const fbTimestamp = (await tooltipLoc.textContent())?.trim() ?? null;
  return fbTimestamp;
};

// Browser-agnostic - util
/**
 * Parse the timestamp formatted by Facebook into ISO timestamp.
 *
 * From:
 * "Monday, June 24, 2013 at 5:20 PM"
 *
 * To:
 * "2013-06-24T17:20:00Z"
 */
const parseFBTimestamp = (timestampStr: string) => {
  const normTimestampStr = timestampStr.trim().replace(/\s+/g, ' ');

  // Parse text into time units
  const regexRes = normTimestampStr.match(REGEX.TIMESTAMP_DATETIME);
  const {
    groups: { month, dayOfMonth, year, hour, minute, timeOfDay },
  } = regexRes || { groups: {} as any };

  // Convert month from text ('August') to double-digit numeric ('08')
  const monthDate = parseDate(month, 'MMMM', new Date());
  const parsedMonth = formatDate(monthDate, 'MM');
  // Add 12 hours if the time was PM
  const hourAdjusted = timeOfDay.toLowerCase().includes('pm') ? Number.parseInt(hour) + 12 : hour;
  const timestamp = `${year}‐${parsedMonth}‐${dayOfMonth}T${hourAdjusted}:${minute}:00Z`;
  return timestamp;
};

// DOM Action
/**
 * Handles extracting stats from:
 * - Albums - https://www.facebook.com/media/set/?set=oa.186299054803655&type=3
 *          - https://www.facebook.com/media/set/?set=oa.187284474705113
 * - Photos - https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
 *          - https://www.facebook.com/photo/?fbid=1384528728428950&set=g.185350018231892
 * - Videos - https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
 */
const getPostStats = async <T extends unknown>(dom: DOMLib<T, any>) => {
  // 1. Find container with post stats
  const likesEl = await dom.findOne('[aria-label*="Like:"]');
  const commentElCandidates = await dom.findMany('[role="button"] [dir="auto"]');
  const commentsEl = await serialAsyncFind(commentElCandidates, async (domEl) => {
    const text = await domEl.text();
    return text?.match(REGEX.COMMENT_COUNT);
  });

  let statsContainerEl: DOMLib<T, unknown> | null = null;
  if (likesEl?.node && commentsEl?.node) {
    statsContainerEl = await likesEl.getCommonAncestor(commentsEl.node);
  }

  // 2. Extract likes
  let likesCount: number | null = null;
  if (likesEl) {
    // "Like: 24 people"
    const likesText = (await likesEl.prop<string | null>('aria-label')) ?? 'like: 0';
    // "24" possibly also "2,400"
    const regexRes = likesText.match(REGEX.LIKE_COUNT);
    const { groups: { likes } } = regexRes || { groups: {} as any }; // prettier-ignore
    likesCount = likes ? Number.parseFloat(likes.replace(/[,\s]+/g, '')) : 0;
  }

  // 3. Extract comments
  let commentsCount: number | null = null;
  if (commentsEl) {
    // "1 comment" or "6 comments", possibly "6,000 comments"
    const commentsText = await commentsEl.text();
    // "1" possibly also "6,000"
    const regexRes = commentsText?.match(REGEX.COMMENT_COUNT);
    const { groups: { comments } } = regexRes || { groups: {} as any }; // prettier-ignore
    commentsCount = comments ? Number.parseFloat(comments.replace(/[,\s]+/g, '')) : 0;
  }

  // 4. Extract views
  let viewsCount: number | null = null;
  if (statsContainerEl) {
    const statEls = await statsContainerEl.children();
    const viewsEl = await serialAsyncFind(statEls, async (domEl) => {
      const text = await domEl.text();
      return text?.match(/views/i);
    });
    if (viewsEl) {
      // "6.9K views"
      const viewsText = await viewsEl.textAsLower();
      const regexRes = viewsText?.match(REGEX.VIEW_COUNT);
      const { groups: { views, viewsUnit } } = regexRes || { groups: {} as any }; // prettier-ignore
      // Convert "6.9K" to `6900`
      const viewsNum = views ? Number.parseFloat(views.replace(/[,\s]+/g, '')) : 0;
      const viewsUnitMultiples = { k: 1000, m: 10 ** 6, b: 10 ** 9, t: 10 ** 12 };
      const viewsMulti = (viewsUnitMultiples as any)[viewsUnit] || 1;
      viewsCount = viewsNum * viewsMulti;
    }
  }

  return {
    likesCount,
    commentsCount,
    viewsCount,
    sharesCount: null,
  } satisfies PostStats;
};

/**
 * DOM ACTION
 *
 * Handles extracting metadata from posts that have authors:
 * - Photos - https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
 *          - https://www.facebook.com/photo/?fbid=1384528728428950&set=g.185350018231892
 * - Videos - https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
 *
 * DOES NOT WORK WITH FOLLOWING:
 * - Albums - https://www.facebook.com/media/set/?set=oa.186299054803655&type=3
 *          - https://www.facebook.com/media/set/?set=oa.187284474705113
 */
const getAuthoredPostMetadata = async <T extends unknown>(
  timestampEl: DOMLib<T, any> | null,
  endEl: DOMLib<T, any> | null,
  prentLog?: Log
) => {
  const logger = prentLog?.child({ prefix: 'AuthoredPostMetadata_' });
  // 1. Find container with post metadata by "triaging" it as a common ancestor
  //    of a timestamp element (which is present in all cases), and another one.
  //    The second element changes on different layouts, so we have to provide it
  //    from the outside.
  logger?.debug('001: Finding metadata container');
  const metadataContainerEl =
    endEl?.node && timestampEl?.node ? await timestampEl.getCommonAncestor(endEl.node) : null;

  // 2. Get author info
  logger?.debug('002: Finding elements within metadata container');
  const authorContainerEl = (await metadataContainerEl?.children())?.[0];
  const authorProfileImgThumbEl = (await authorContainerEl?.findOne('image')) ?? null;
  const authorProfileLinkEl = (await authorProfileImgThumbEl?.closest('a')) ?? null;

  logger?.debug('003: Extracting metadata info');
  const authorProfileImageThumbUrl = (await authorProfileImgThumbEl?.attr('href')) ?? null;

  const authorName = (await authorProfileLinkEl?.attr('aria-label')) ?? null;
  const authorProfileUrlRaw = (await authorProfileLinkEl?.attr('href')) ?? null;
  const authorProfileUrl =
    !authorProfileUrlRaw || authorProfileUrlRaw === '#'
      ? null
      : (await authorProfileLinkEl?.prop<string | null>('href')) ?? null;

  // 3. Get post text
  // NOTE: We find the post description by finding the element that contains both the known elements
  //       AND the description. Known elements are BEFORE the description, so we "subtract"
  //       it from the joint text.
  logger?.debug('004: Extracting post description');
  const metadataText = (await metadataContainerEl?.text()) ?? null;
  const metadataPlusDescText = (await (await metadataContainerEl?.parent())?.text()) ?? null;
  const description =
    metadataPlusDescText && metadataText
      ? metadataPlusDescText?.split(metadataText)[1].trim() ?? null
      : metadataPlusDescText ?? null;
  // TODO - DO we need to handle the "See more"?

  return {
    authorProfileImageThumbUrl,
    authorName,
    authorProfileUrl,
    description,
  };
};

/**
 * Handles extracting metadata from posts that have authors:
 * - Photos - https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
 *          - https://www.facebook.com/photo/?fbid=1384528728428950&set=g.185350018231892
 * - Videos - https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
 *
 * DOES NOT WORK WITH FOLLOWING:
 * - Albums - https://www.facebook.com/media/set/?set=oa.186299054803655&type=3
 *          - https://www.facebook.com/media/set/?set=oa.187284474705113
 */
const getAlbumMetadata = async <T extends unknown>(dom: DOMLib<T, any>) => {
  // 1. Find container with post metadata
  const timestampEl = await getPostTimestampEl(dom);
  const albumsLinkEl = await dom.findOne('[href*="/media/albums"][role="link"]');

  const metadataContainerEl =
    albumsLinkEl?.node && timestampEl?.node
      ? await albumsLinkEl.getCommonAncestor(timestampEl.node)
      : null;

  // 2. Get post text
  // NOTE: We find the post description by finding the element that contains both the known elements
  //       AND the description. Known elements are BEFORE the description, so we "subtract"
  //       it from the joint text.
  const metadataText = (await metadataContainerEl?.text()) ?? null;
  const albumsLinkText = (await albumsLinkEl?.text()) ?? null;
  const timestampText = (await timestampEl?.text()) ?? null;
  let description = metadataText ?? null;
  if (description && albumsLinkText) description = description.split(albumsLinkText)[1]; // Remove preceding text
  if (description && timestampText) description = description.split(timestampText)[0]; // Remove trailing text
  description = description?.split('·').slice(0, -1).join('.').trim() ?? null; // Clean up leftover artifacts

  // TODO - DO we need to handle the "See more"?

  return {
    description,
  };
};

const makeCheerioDom = async (ctx: PlaywrightCrawlingContext, url: string | null) => {
  const cheerioDom = await ctx.parseWithCheerio();
  const domLib = cheerioDOMLib(cheerioDom.root(), url);
  return domLib;
};

const makeImageMeta = async <T extends object>(url?: string | null, extraProps?: T) => {
  const imageMetadata = url ? await getImageMetaFromUrl(url) : imageMeta();
  return { ...(extraProps as T), ...imageMetadata };
};

const pingForAndClosePopups = (page: Page, freq = 1000) => {
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
};

export const closePopupsRouterWrapper: CrawlerRouterWrapper<
  PlaywrightCrawlingContext<any>,
  FbGroupMediaRouterContext
> = (origRouterHandler) => {
  return (ctx, ...args) => {
    pingForAndClosePopups(ctx.page);
    return origRouterHandler(ctx, ...args);
  };
};

const searchFbPayloads = async (
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
};

const waitAfterInfiniteScroll = async (el: unknown, { page }: { page: Page }) => {
  await page.waitForLoadState('networkidle');
  await wait(2000);
  await page.waitForLoadState('networkidle');
};

const scrollIntoView = (handle: JSHandle<Element | null>, scrollBackOffset = 200) => {
  return handle.evaluate(
    (el, { offsetY }) => {
      if (!el) return;
      // Scroll into view
      el?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });

      // Then scroll a bit up again
      return new Promise<void>((res) => {
        setTimeout(() => {
          window.scrollTo({
            left: window.scrollX,
            top: window.scrollY - offsetY,
            behavior: 'smooth',
          });
          res();
        }, 500);
      });
    },
    { offsetY: scrollBackOffset }
  );
};

export const routes = [
  {
    // Group media page with specific tab selected
    // E.g. https://www.facebook.com/groups/185350018231892/media/photos
    name: 'FB_GROUP_MEDIA_TAB',
    handlerLabel: 'FB_GROUP_MEDIA_TAB',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_GROUP_MEDIA_TAB_URL);
    },
  },
  {
    // Group media page
    // E.g. https://www.facebook.com/groups/185350018231892/media
    name: 'FB_GROUP_MEDIA',
    handlerLabel: 'FB_GROUP_MEDIA',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_GROUP_MEDIA_URL);
    },
  },
  {
    // Group page
    // E.g. https://www.facebook.com/groups/185350018231892
    name: 'FB_GROUP',
    handlerLabel: 'FB_GROUP',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_GROUP_URL);
    },
  },
  {
    // Album page
    // E.g. https://www.facebook.com/media/set/?set=oa.187284474705113
    name: 'FB_MEDIA_ALBUM',
    handlerLabel: 'FB_MEDIA_ALBUM',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_ALBUM_URL);
    },
  },
  {
    // Photo page
    // E.g. https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
    name: 'FB_MEDIA_PHOTO',
    handlerLabel: 'FB_MEDIA_PHOTO',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_PHOTO_URL);
    },
  },
  {
    // Video page
    // E.g. https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
    name: 'FB_MEDIA_VIDEO',
    handlerLabel: 'FB_MEDIA_VIDEO',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(REGEX.FB_VIDEO_URL);
    },
  },
] satisfies RouteMatcher<PlaywrightCrawlingContext<any>, {}, FbGroupMediaRouteLabel>[];

const mediaTypeConfig = {
  photos: {
    tabSelector: '[href*="/photos/"][role="tab"]',
    linkSelector: '[href*="/photo/"][role="link"]',
  },
  videos: {
    tabSelector: '[href*="/videos/"][role="tab"]',
    linkSelector: '[href*="/videos/"][role="link"]',
  },
  albums: {
    tabSelector: '[href*="/albums/"][role="tab"]',
    linkSelector: '[href*="/set/"][role="link"]',
  },
};

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export const createHandlers = <Ctx extends PlaywrightCrawlingContext>(
  input: FbGroupMediaActorInput | null
) => {
  const { outputMaxEntries } = input ?? {};

  return {
    // Go to group's media page
    // E.g. `https://www.facebook.com/groups/185350018231892/media`
    FB_GROUP: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      const url = ctx.page.url();
      const urlObj = new URL(url);
      const {
        groups: { groupId },
      } = urlObj.pathname.match(REGEX.FB_GROUP_URL) || { groups: {} as any }; // prettier-ignore
      urlObj.pathname = `/groups/${groupId}/media`;
      const newUrl = urlObj.toString();

      ctx.log.debug(`Opening default request queue`);
      const reqQueue = await Actor.openRequestQueue();

      ctx.log.info(`Redirecting to media page of FB group with ID ${groupId}`);
      await reqQueue.addRequest({ url: newUrl });
    },

    // Select all media tabs and enqueue them
    FB_GROUP_MEDIA: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      const pageUrl = ctx.page.url();
      const {
        groups: { groupId },
      } = new URL(pageUrl).pathname.match(REGEX.FB_GROUP_MEDIA_URL) || { groups: {} as any }; // prettier-ignore

      ctx.log.debug(`Opening default request queue`);
      const reqQueue = await Actor.openRequestQueue();

      ctx.log.debug(`Searching for tabs for individual media types for FB group (ID "${groupId}")`);
      const tabSelector = Object.values(mediaTypeConfig).map((c) => c.tabSelector).join(', '); // prettier-ignore
      const tabLinks = await ctx.page
        .locator(tabSelector)
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href));

      ctx.log.info(`Enqueuing ${tabLinks.length} tab links to default request queue`);
      await reqQueue.addRequests(tabLinks.map((url) => ({ url })));
    },

    // Find all available media on specific tab and enqueue them
    FB_GROUP_MEDIA_TAB: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      await wait(2000);

      const url = ctx.page.url();
      const {
        groups: { groupId, tab },
      } = new URL(url).pathname.match(REGEX.FB_GROUP_MEDIA_TAB_URL) || { groups: {} as any }; // prettier-ignore

      ctx.log.debug(`Opening default request queue`);
      const reqQueue = await Actor.openRequestQueue();

      const linkSelector = Object.values(mediaTypeConfig).map((c) => c.linkSelector).join(', '); // prettier-ignore
      ctx.log.debug(`linkSelector: ${linkSelector}`);

      // 2. Find the container that includes all items loaded through infinite scroll.
      //
      // We didn't use the built-in infinite scroll method to reduce the risk of losing
      // data mid-way. Imagine following scenario:
      //   1. We come across a page that has thousands of links.
      //   2. We wait till we scroll all the way down before extracting the links.
      //   3. Mid-way, an error occurs. Browser fails, and no links get extracted/
      //
      // Instead, we want to extract the entries as they are added to the container.
      //
      // NOTE: The selector we have is NOT NECESSARILY SAME as the container's children.
      // E.g. there is something INSIDE children that we can select, and that's how we know.
      ctx.log.debug(`Looking for infinite scroll container in "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore
      const bodyHandle = await ctx.page.evaluateHandle(() => document.body);
      const domLib = playwrightDOMLib(bodyHandle, ctx.page);
      const pageLib = await playwrightPageLib(ctx.page);
      const containerElHandle = await domLib.getCommonAncestorFromSelector(linkSelector);

      if (!containerElHandle?.node) {
        ctx.log.error(`Failed to find infinite scroll container in "${tab}" tab with for FB group (ID "${groupId}")`); // prettier-ignore
        return;
      }

      // 3. Scroll down and process new entries when they appear
      ctx.log.info(`Starting infinite scroll in "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore

      let itemsCount = 0;
      await pageLib.infiniteScroll(
        containerElHandle.node,
        async (newElsHandle, _, stopFn) => {
          // 4. Get links from new entries
          ctx.log.debug(`Parsing new results from "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore
          const links = await newElsHandle.evaluate((els) => {
            return els.reduce<string[]>((agg, el) => {
              if (el) {
                const linkEl = el.nodeName === 'A' ? el : el.querySelector('a');
                if (linkEl) agg.push((linkEl as HTMLAnchorElement).href);
              }
              return agg;
            }, []);
          });

          itemsCount += links.length;

          // 5. Push new entries to the queue
          ctx.log.info(`Enqueuing ${links.length} (total: ${itemsCount}) new links to default request queue`); // prettier-ignore
          await reqQueue.addRequests(links.map((url) => ({ url })));
          ctx.log.debug(`Done enqueuing ${links.length} (total: ${itemsCount}) new links to default request queue`); // prettier-ignore

          if (outputMaxEntries != null && itemsCount > outputMaxEntries) stopFn();
        },
        { waitAfterScroll: waitAfterInfiniteScroll, scrollIntoView: (el) => scrollIntoView(el) }
      );
      ctx.log.info(`Finished infinite scroll in "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore
    },

    // Scrape data from a Photo post
    // E.g. https://www.facebook.com/photo/?fbid=10152026359419698&set=g.185350018231892
    FB_MEDIA_PHOTO: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      const logger = ctx.log.child({ prefix: 'fb_photo_' });
      const pageUrl = ctx.page.url();

      // 1. Get parent Album and fbid from URL
      // E.g. `/photo/?fbid=10150775445404199&set=oa.187284474705113`
      logger.debug(`001: Extracting data from URL`);
      const {
        groups: { groupId },
      } = new URL(pageUrl).pathname.match(REGEX.FB_GROUP_URL) || { groups: {} as any }; // prettier-ignore
      const { set: albumId, fbid } = getSearchParams(pageUrl, ['set', 'fbid']);

      // Page Action
      const getPhotoFullSize = async (page: Page) => {
        // Click on burger menu
        await page.locator('[aria-haspopup="menu"][role="button"]').click();
        // Get download link from "Download" button
        // E.g. `https://scontent.fbts9-1.fna.fbcdn.net/v/t1.18169-9/943215_10152026359419698_1217123876_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=5bac3a&_nc_ohc=XOJrEHxMTNQAX8hxfRO&_nc_ht=scontent.fbts9-1.fna&oh=00_AfCG9L7cPi_ljSl8ehI6H5lIbgl3LX7TdD9TgHJ2l6U66A&oe=64DE41D6&dl=1`

        // NOTE: https://stackoverflow.com/questions/10280250/getattribute-versus-element-object-properties
        const rawImgUrl = await page
          .locator('[download][role="menuitem"]')
          .evaluate((el) => (el as HTMLAnchorElement).href);

        // Close the burger menu
        await page.locator('[aria-haspopup="menu"][role="button"]').click();

        if (!rawImgUrl) return null;

        // Remove "dl=1" query param from the link, so it doesn't force download automatically
        const imgUrl = removeSearchParams(rawImgUrl, ['dl']);
        return imgUrl;
      };

      // DOM Action
      const getPhotoPreview = async <T extends unknown>(dom: DOMLib<T, any>) => {
        // Find preview photo
        const imgEl = await dom.findOne('[data-pagelet="MediaViewerPhoto"] img');
        const [url, alt] = (await imgEl?.props<(string | null)[]>(['src', 'alt'])) ?? [null, null];
        return { url, alt };
      };

      const getPhotoDataFromPayloads = async (page: Page) => {
        // Prefilter helps us avoid parsing irrelevant payloads
        const prefilter = await page.evaluateHandle(() => {
          return (el: Element) => el.textContent?.includes('result');
        });
        // Main filter searches for payloads with info on the photo
        const photoFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.currMedia;
        });
        const statsFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.comment_list_renderer;
        });
        const authorFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.owner && d.owner.profile_picture;
        });
        const [rawPhotoPayload] = await searchFbPayloads(page, photoFilter, { prefilter });
        const [rawStatsPayload] = await searchFbPayloads(page, statsFilter, { prefilter });
        const [rawAuthorPayload] = await searchFbPayloads(page, authorFilter, { prefilter });

        const statsPayload = {
          commentsCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.total_comment_count ?? null,
          likesCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.reaction_count?.count ?? null,
          shareCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.share_count?.count ?? null,
        } // prettier-ignore
        const photoPayload = {
          imagePreview: {
            url: rawPhotoPayload?.currMedia?.image?.uri ?? null,
            alt: rawPhotoPayload?.currMedia?.accessibility_caption ?? null,
            height: rawPhotoPayload?.currMedia?.image.height ?? null,
            width: rawPhotoPayload?.currMedia?.image?.width ?? null,
            size: null,
            mime: null,
          } satisfies FbPhotoPostEntry['imagePreview'],
          likesCount: rawPhotoPayload?.currMedia?.feedback?.reactors?.count ?? null,
          timestamp: rawPhotoPayload?.currMedia?.created_time
            ? new Date(rawPhotoPayload?.currMedia?.created_time * 1000).toISOString()
            : null,
        };
        const authorPayload = {
          authorName: rawAuthorPayload?.owner?.name ?? null,
          authorFbid: rawAuthorPayload?.owner?.id ?? null,
          authorProfileUrl: rawAuthorPayload?.owner?.profile_picture?.uri ?? null,
        };
        const photoData = {
          imagePreview: photoPayload.imagePreview,
          commentsCount: statsPayload.commentsCount,
          likesCount: photoPayload.likesCount ?? statsPayload.likesCount,
          sharesCount: statsPayload.shareCount,
          viewsCount: null as number | null,
          timestamp: photoPayload.timestamp,
          authorName: authorPayload.authorName,
          authorFbid: authorPayload.authorFbid,
          authorProfileUrl: authorPayload.authorProfileUrl,
        } satisfies Partial<FbPhotoPostEntry>;

        return photoData;
      };

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`002: Searching for payloads with post info`);
      const photoData = await getPhotoDataFromPayloads(ctx.page);

      // 2. Get full-size photo URL + metadata
      logger.debug(`003: Extracting full-size image`);
      const imageFullSizeUrl = await getPhotoFullSize(ctx.page);

      // 3. Get preview photo URL
      logger.debug(`004: Extracting preview image`);
      if (!photoData.imagePreview.url || !photoData.imagePreview.alt) {
        const domLib = await makeCheerioDom(ctx, pageUrl);
        const { url, alt } = await getPhotoPreview(domLib);
        if (url) photoData.imagePreview.url = url;
        if (alt) photoData.imagePreview.alt = alt;
      }

      // 4. Get post timestamp
      logger.debug(`005: Extracting post timestamp`);
      if (!photoData.timestamp) {
        const timestampRaw = await getPostTimestampValue(ctx.page, logger);
        logger.debug(`006: Normalising timestamp "${timestampRaw}"`);
        const timestamp = timestampRaw ? parseFBTimestamp(timestampRaw) : null;
        photoData.timestamp = timestamp;
      }

      // 5. Get likes, comments, (and views for videos) counts
      logger.debug(`007: Extracting post stats`);
      // prettier-ignore
      if ([photoData.commentsCount, photoData.likesCount, photoData.commentsCount].some((d) => d == null)) {
        const domLib = await makeCheerioDom(ctx, pageUrl);
        const { likesCount, commentsCount, viewsCount } = await getPostStats(domLib);
        if (likesCount != null) photoData.likesCount = likesCount;
        if (commentsCount != null) photoData.commentsCount = commentsCount;
        if (viewsCount != null) photoData.viewsCount = viewsCount;
      }

      // 6. Get authorName, authorProfileUrl, authorProfileImgUrl, post text
      logger.debug(`008: Finding post metadata element`);
      const domLib = await makeCheerioDom(ctx, pageUrl);
      const burgerMenuEl = await domLib.findOne('[aria-haspopup="menu"][role="button"]');
      const timestampEl = await getPostTimestampEl(domLib);
      logger.debug(`009: Extracting post metadata`);
      const { authorProfileImageThumbUrl, description, ...postMetadata } = await getAuthoredPostMetadata(timestampEl, burgerMenuEl, logger); // prettier-ignore
      if (!photoData.authorName) photoData.authorName = postMetadata.authorName;
      if (!photoData.authorProfileUrl) photoData.authorProfileUrl = postMetadata.authorProfileUrl;

      // 7. Get extra metadata for images
      logger.debug(`010: Fetching metadata for images`);
      const imageFullSize = await makeImageMeta(imageFullSizeUrl);
      const imagePreview = await makeImageMeta(photoData.imagePreview.url, photoData.imagePreview); // prettier-ignore
      const authorProfileImageThumb = await makeImageMeta(authorProfileImageThumbUrl);

      const entry = {
        ...photoData,
        url: pageUrl,
        type: 'photo',
        fbid,
        albumId,
        groupId,
        description,
        imagePreview,
        imageFullSize,
        authorProfileImageThumb,
      } satisfies FbPhotoPostEntry;

      await ctx.actor.pushData(entry, ctx, {
        privacyMask: {
          authorName: () => true,
          authorProfileUrl: () => true,
          authorProfileImageThumb: {
            url: () => true,
          },
        },
      });

      // TODO 7. Comments?
      //   - Use https://apify.com/apify/facebook-comments-scraper/input-schema
      //     - Commenter names are NOT included
    },

    // Scrape data from a Video post
    // E.g. https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
    FB_MEDIA_VIDEO: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      const logger = ctx.log.child({ prefix: 'fb_photo_' });
      const url = ctx.page.url();
      let domLib = await makeCheerioDom(ctx, url);

      // DOM Action
      const getVideoPostVideo = async <T extends unknown>(dom: DOMLib<T, any>) => {
        // Find video
        const videoEl = await dom.findOne('[data-pagelet="WatchPermalinkVideo"] video');
        const props = await videoEl?.props<MaybeArrayItems<[string, number, number, number]>>(
          ['src', 'duration', 'videoHeight', 'videoWidth']
        ); // prettier-ignore
        const [videoUrl = null, videoDuration = null, videoHeight = null, videoWidth = null] = props ?? []; // prettier-ignore

        return {
          videoUrl,
          videoDuration,
          videoHeight,
          videoWidth,
          // NOTE: MIME type omitted, bc it can get complex
        };
      };

      // DOM Action
      const getVideoThumb = async <T extends unknown>(dom: DOMLib<T, any>) => {
        // Find preview photo
        const imgEl = await dom.findOne('[data-pagelet="WatchPermalinkVideo"] img');
        const [url, alt] = (await imgEl?.props<(string | null)[]>(['src', 'alt'])) ?? [null, null];
        return { url, alt };
      };

      const getVideoDataFromPayloads = async (page: Page) => {
        // Prefilter helps us avoid parsing irrelevant payloads
        const prefilter = await page.evaluateHandle(() => {
          return (el: Element) => el.textContent?.includes('result');
        });
        // Main filters search for payloads with info on the video
        const pageInfoFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.params && d.meta;
        });
        const videoFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.video && d.video.story;
        });
        const authorFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.title && d.owner && d.owner.name;
        });
        const commentFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.feedback && d.feedback.comment_list_renderer;
        }); // prettier-ignore
        const statsFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.feedback && d.feedback.video_view_count_renderer;
        }); // prettier-ignore

        const [rawPageInfoPayload] = await searchFbPayloads(page, pageInfoFilter, { prefilter });
        const [rawVideoPayload] = await searchFbPayloads(page, videoFilter, { prefilter });
        const [rawAuthorPayload] = await searchFbPayloads(page, authorFilter, { prefilter });
        const [rawCommentPayload] = await searchFbPayloads(page, commentFilter, { prefilter });
        const [rawStatsPayload] = await searchFbPayloads(page, statsFilter, { prefilter });

        const pageInfoPayload = {
          fbid: rawPageInfoPayload?.params?.fbid || rawPageInfoPayload?.params?.video_id || rawPageInfoPayload?.params?.v,
          albumId: rawPageInfoPayload?.params?.set,
          videoTitle: rawPageInfoPayload?.meta?.title?.split('|')[0].trim(),
        }; // prettier-ignore

        const vidMedia = rawVideoPayload?.video?.story?.attachments?.[0]?.media ?? null;
        const videoPayload = {
          url: (vidMedia?.browser_native_hd_url || vidMedia?.browser_native_sd_url) ?? null,
          height: vidMedia?.height ?? null,
          width: vidMedia?.width ?? null,
          fbid: (vidMedia?.id || vidMedia?.videoId) ?? null,
          duration: vidMedia?.playable_duration_in_ms
            ? vidMedia?.playable_duration_in_ms / 1000
            : null,
          thumbnailUrl: vidMedia?.preferred_thumbnail?.image?.uri ?? null,
          timestamp: vidMedia?.publish_time
            ? new Date(vidMedia?.publish_time * 1000).toISOString()
            : null,
          groupId: vidMedia?.recipient_group?.id ?? null,
        }; // prettier-ignore

        const authorSecs = rawAuthorPayload?.creation_story?.comet_sections ?? {};
        const authorDetail = authorSecs?.actor_photo?.story?.actors?.[0] ?? null;
        const creationTime =
          authorSecs.metadata.find((d: any) => d?.story?.creation_time)?.story?.creation_time ??
          null;
        const authorPayload = {
          authorFbid: rawAuthorPayload?.owner?.id ?? null,
          authorName: (rawAuthorPayload?.owner?.name || authorDetail?.name) ?? null,
          authorProfileUrl: (authorDetail?.profile_url || authorDetail?.url) ?? null,
          authorProfileImgUrl: authorDetail?.profile_picture?.uri ?? null,
          authorProfileImgWidth: authorDetail?.profile_picture?.width ?? null,
          authorProfileImgHeight: authorDetail?.profile_picture?.height ?? null,
          postedToEntityFbid: authorSecs?.title?.story?.to?.id ?? null,
          postedToEntityName: authorSecs?.title?.story?.to?.name ?? null,
          postedToEntityUrl: authorSecs?.title?.story?.to?.url ?? null,
          timestamp: creationTime ? new Date(creationTime * 1000).toISOString() : null,
          videoTitle: authorSecs?.message?.story?.message?.text ?? null,
        }; // prettier-ignore

        const commentPayload = {
          commentCount: rawCommentPayload?.feedback?.comment_list_renderer?.feedback?.comment_count?.total_count ?? null,
          groupId: rawCommentPayload?.feedback?.comment_list_renderer?.feedback?.top_level_comment_list_renderer?.feedback?.associated_group?.id ?? null,
        }; // prettier-ignore

        const vidCountObj = rawStatsPayload?.feedback?.video_view_count_renderer?.feedback ?? null;
        const statsPayload = {
          fbid: rawStatsPayload?.id ?? null,
          viewCount: (vidCountObj?.video_post_view_count || vidCountObj?.feedback.video_view_count) ?? null,
          commentCount: rawStatsPayload?.total_comment_count ?? null,
          likesCount: (rawStatsPayload?.feedback?.reaction_count?.count || rawStatsPayload?.feedback?.cannot_see_top_custom_reactions?.reactors?.count) ?? null,
          videoTitle: rawStatsPayload?.creation_story?.message?.text ?? null,
        }; // prettier-ignore

        const videoData = {
          fbid: pageInfoPayload.fbid ?? videoPayload.fbid ?? statsPayload.fbid,
          albumId: pageInfoPayload.albumId,
          groupId: videoPayload.groupId ?? commentPayload.groupId,
          userId: null,
          videoId: null,
          timestamp: videoPayload.timestamp ?? authorPayload.timestamp,
          
          videoUrl: videoPayload.url,
          videoTitle: authorPayload.videoTitle ?? statsPayload.videoTitle ?? pageInfoPayload.videoTitle,
          videoHeight: videoPayload.height,
          videoWidth: videoPayload.width,
          videoDuration: videoPayload.duration,
          videoThumbImage: {
            ...imageMeta({ url: videoPayload.thumbnailUrl }),
            alt: null as null | string,
          },

          authorFbid: authorPayload.authorFbid,
          authorName: authorPayload.authorName,
          authorProfileUrl: authorPayload.authorProfileUrl,
          authorProfileImageThumb: {
            url: authorPayload.authorProfileImgUrl,
            width: authorPayload.authorProfileImgWidth,
            height: authorPayload.authorProfileImgHeight,
            size: null,
            mime: null,
          },

          commentsCount: commentPayload.commentCount ?? statsPayload.commentCount,
          viewsCount: statsPayload.viewCount,
          likesCount: statsPayload.likesCount,
          sharesCount: null as number | null,

          postedToEntityFbid: authorPayload.postedToEntityFbid,
          postedToEntityName: authorPayload.postedToEntityName,
          postedToEntityUrl: authorPayload.postedToEntityUrl,
        } satisfies Partial<FbVideoPostEntry>; // prettier-ignore

        return videoData;
      };

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`001: Searching for payloads with post info`);
      const videoData = await getVideoDataFromPayloads(ctx.page);

      // 2. Get parent Album and fbid from URL
      // E.g. `/photo/?fbid=10150775445404199&set=oa.187284474705113`
      logger.debug(`002: Extracting data from URL`);
      if ([videoData.albumId, videoData.fbid, videoData.userId, videoData.videoWidth].some((d) => d == null)) {
        const { set: albumId, fbid } = getSearchParams(url, ['set', 'fbid']);
        const urlRegex = new URL(url).pathname.match(REGEX.FB_VIDEO_URL);
        const { groups: { userId, videoId } } = urlRegex || { groups: {} as any }; // prettier-ignore
        if (videoData.albumId == null) videoData.albumId = albumId;
        if (videoData.fbid == null) videoData.fbid = fbid;
        if (videoData.userId == null) videoData.userId = userId;
        if (videoData.videoId == null) videoData.videoId = videoId;
      } // prettier-ignore

      // 3. Get video URL
      logger.debug(`003: Extracting video URL`);
      if ([videoData.videoUrl, videoData.videoDuration, videoData.videoHeight, videoData.videoWidth].some((d) => d == null)) {
        const { videoUrl, videoDuration, videoHeight, videoWidth } = await getVideoPostVideo(domLib);
        if (videoData.videoUrl == null) videoData.videoUrl = videoUrl;
        if (videoData.videoDuration == null) videoData.videoDuration = videoDuration;
        if (videoData.videoHeight == null) videoData.videoHeight = videoHeight;
        if (videoData.videoWidth == null) videoData.videoWidth = videoWidth;
      } // prettier-ignore

      // 4. Get video thumb photo
      logger.debug(`004: Extracting video preview image`);
      if ([videoData.videoThumbImage.url, videoData.videoThumbImage.alt].some((d) => d == null)) {
        const videoThumb = await getVideoThumb(domLib);
        if (videoData.videoThumbImage.url == null) videoData.videoThumbImage.url = videoThumb.url;
        if (videoData.videoThumbImage.alt == null) videoData.videoThumbImage.alt = videoThumb.alt;
      } // prettier-ignore

      // 5. Get post timestamp
      logger.debug(`005: Extracting post timestamp`);
      if (!videoData.timestamp) {
        const timestampRaw = await getPostTimestampValue(ctx.page, logger);
        logger.debug(`005.1: Normalising timestamp "${timestampRaw}"`);
        const timestamp = timestampRaw ? parseFBTimestamp(timestampRaw) : null;
        videoData.timestamp = timestamp;
      } // prettier-ignore

      // 6. Get likes, comments, (and views for videos) counts
      logger.debug(`006: Extracting post stats`);
      if ([videoData.videoUrl, videoData.videoDuration, videoData.videoHeight, videoData.videoWidth].some((d) => d == null)) {
        domLib = await makeCheerioDom(ctx, url);
        const { likesCount, commentsCount, sharesCount, viewsCount } = await getPostStats(domLib);
        if (videoData.likesCount == null) videoData.likesCount = likesCount;
        if (videoData.commentsCount == null) videoData.commentsCount = commentsCount;
        if (videoData.sharesCount == null) videoData.sharesCount = sharesCount;
        if (videoData.viewsCount == null) videoData.viewsCount = viewsCount;
      } // prettier-ignore

      // 7. Get authorName, authorProfileUrl, authorProfileImgUrl, post text
      logger.debug(`007: Finding post metadata element`);
      const menuEl = (await domLib.findMany('[aria-label="More"][role="button"]')).slice(-1)[0];
      const timestampEl = await getPostTimestampEl(domLib);
      logger.debug(`008: Extracting post metadata`);
      const { authorProfileImageThumbUrl, description, ...postMetadata } = await getAuthoredPostMetadata(timestampEl, menuEl, logger); // prettier-ignore
      if (!videoData.authorName) videoData.authorName = postMetadata.authorName;
      if (!videoData.authorProfileUrl) videoData.authorProfileUrl = postMetadata.authorProfileUrl;

      logger.debug(`009: Fetching metadata for images`);
      const videoThumbImage = await makeImageMeta(videoData.videoThumbImage.url, videoData.videoThumbImage); // prettier-ignore
      const authorProfileImageThumb = await makeImageMeta(authorProfileImageThumbUrl);

      const entry = {
        ...videoData,
        url,
        type: 'video',
        description,
        videoThumbImage,
        authorProfileImageThumb,
      } satisfies FbVideoPostEntry;

      await ctx.actor.pushData(entry, ctx, {
        privacyMask: {
          userId: () => true,
          authorName: () => true,
          authorProfileUrl: () => true,
          authorProfileImageThumb: {
            url: () => true,
          },
        },
      });

      // TODO 7. Comments?
      //   - Use https://apify.com/apify/facebook-comments-scraper/input-schema
      //     - Commenter names are NOT included
    },

    // Scrape data from an Album post
    // E.g. https://www.facebook.com/media/set/?set=oa.187284474705113
    FB_MEDIA_ALBUM: async (ctx) => {
      await ctx.page.waitForLoadState('networkidle');
      const logger = ctx.log.child({ prefix: 'fb_album_' });
      const pageUrl = ctx.page.url();

      logger.debug(`000: Opening default request queue`);
      const reqQueue = await Actor.openRequestQueue();

      const getAlbumDataFromPayloads = async (page: Page) => {
        // Prefilter helps us avoid parsing irrelevant payloads
        const prefilter = await page.evaluateHandle(() => {
          return (el: Element) => el.textContent?.includes('result');
        });
        // Main filter searches for payloads with info on the photo
        const albumFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.album && d.album.contributors;
        });
        const statsFilter = await page.evaluateHandle(() => {
          return (d: any) => d && typeof d === 'object' && d.comet_ufi_summary_and_actions_renderer && d.associated_group;
        }); // prettier-ignore

        const [rawAlbumPayload] = await searchFbPayloads(page, albumFilter, { prefilter });
        const [rawStatsPayload] = await searchFbPayloads(page, statsFilter, { prefilter });

        const albumMediaOwner = rawAlbumPayload?.album?.media_owner_object ?? null;
        const creationTime =
          rawAlbumPayload?.album?.story?.comet_sections?.metadata?.find(
            (d: any) => d?.story?.creation_time
          )?.story?.creation_time ?? null;

        const albumPayload = {
          title: rawAlbumPayload?.album?.title?.text ?? null,
          timestamp: creationTime ? new Date(creationTime * 1000).toISOString() : null,
          albumId: rawAlbumPayload?.album?.reference_token ?? null,
          ownerFbid: albumMediaOwner?.id ?? null,
          ownerName: (albumMediaOwner?.name || albumMediaOwner?.short_name) ?? null,
          ownerUsername: albumMediaOwner?.username ?? null,
          ownerType: albumMediaOwner?.__typename ?? null,
          contributors: rawAlbumPayload?.album?.contributors
            ? await serialAsyncMap(rawAlbumPayload?.album?.contributors as any[], async (c) => {
              const profileImgUrl = c?.profile_picture?.uri ?? null;
              return {
                fbid: c?.id ?? null,
                name: c?.name ?? null,
                url: c?.url ?? null,
                profileImg: profileImgUrl ? await makeImageMeta(profileImgUrl) : null,
              };
            })
            : null,
        }; // prettier-ignore

        const statsPayload = {
          groupId: rawStatsPayload?.associated_group?.id ?? null,
          commentsCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.total_comment_count
            ?? rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.comments_count_summary_renderer?.feedback?.total_comment_count
            ?? null,
          sharesCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.share_count?.count ?? null,
          likesCount: rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.reaction_count?.count
            ?? rawStatsPayload?.comet_ufi_summary_and_actions_renderer?.feedback?.cannot_see_top_custom_reactions?.reactors?.count ?? null,
        }; // prettier-ignore

        const albumData = {
          title: albumPayload.title,
          timestamp: albumPayload.timestamp,
          albumId: albumPayload.albumId,
          ownerFbid: albumPayload.ownerFbid,
          ownerName: albumPayload.ownerName,
          ownerUsername: albumPayload.ownerUsername,
          ownerType: albumPayload.ownerType,
          contributors: albumPayload.contributors,

          groupId: statsPayload.groupId,
          commentsCount: statsPayload.commentsCount,
          sharesCount: statsPayload.sharesCount,
          likesCount: statsPayload.likesCount,
          viewsCount: null as number | null,
        } satisfies Partial<FbAlbumPostEntry>;

        return albumData;
      };

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`001: Searching for payloads with post info`);
      const albumData = await getAlbumDataFromPayloads(ctx.page);
      let { albumId } = albumData;

      // 1. Get Album ID and fbid from URL
      // E.g. `/media/set/?set=oa.187284474705113`
      // NOTE: `fbid` might not exist for Albums
      logger.debug(`001: Extracting data from URL (ID "${albumId}")`);
      if (!albumData.albumId) {
        const { set, fbid } = getSearchParams(pageUrl, ['set', 'fbid']);
        albumData.albumId = albumId = set ?? fbid;
      } // prettier-ignore

      // 2. Get album metadata
      logger.debug(`002: Extracting data from URL (ID "${albumId}")`);
      let chDom = await makeCheerioDom(ctx, pageUrl);
      const { description } = await getAlbumMetadata(chDom);

      // 3. Get timestamp
      logger.debug(`003: Extracting post timestamp (ID "${albumId}")`);
      if (!albumData.timestamp) {
        const timestampRaw = await getPostTimestampValue(ctx.page, logger);
        logger.debug(`003.1: Normalising timestamp "${timestampRaw}" (ID "${albumId}")`);
        const timestamp = timestampRaw ? parseFBTimestamp(timestampRaw) : null;
        albumData.timestamp = timestamp;
      }

      // 4. Get likes, comments, (and views for videos) counts
      // NOTE: We regenerate domLib bc we interacted with page in previous step
      logger.debug(`004: Extracting post stats (ID "${albumId}")`);
      if ([albumData.likesCount, albumData.sharesCount, albumData.commentsCount, albumData.viewsCount].some((d) => d == null)) {
        chDom = await makeCheerioDom(ctx, pageUrl);
        const { commentsCount, likesCount, sharesCount, viewsCount } = await getPostStats(chDom);
        if (albumData.likesCount == null) albumData.likesCount = likesCount;
        if (albumData.commentsCount == null) albumData.commentsCount = commentsCount;
        if (albumData.sharesCount == null) albumData.sharesCount = sharesCount;
        if (albumData.viewsCount == null) albumData.viewsCount = viewsCount;
      } // prettier-ignore

      // 5. Get all entries in the album
      // 5.1. Find container of entries loaded via infinite scroll
      ctx.log.debug(`005: Looking for infinite scroll container for FB album (ID "${albumId}")`);
      const pwPage = await playwrightPageLib(ctx.page);
      const pwDom = playwrightDOMLib(await ctx.page.evaluateHandle(() => document), ctx.page);
      const containerEl = await pwDom.getCommonAncestorFromSelector<ElementHandle<HTMLElement>>(
        '[role="listitem"] [href][role="link"]'); // prettier-ignore

      if (!containerEl?.node) {
        ctx.log.error(`Failed to find infinite scroll container for FB album (ID "${albumId}")`); // prettier-ignore
        return;
      }

      // 5.2. Trigger infinite scroll and parse results as they load
      ctx.log.info(`006: Starting infinite scroll for FB album (ID "${albumId}")`);

      let itemsCount = 0;
      await pwPage.infiniteScroll(
        containerEl.node,
        async (newElsHandle, _, stopFn) => {
          ctx.log.debug(`007: Parsing new infinite scroll results for FB album (ID "${albumId}")`);

          // 5.3. Get links from new entries
          const links = await newElsHandle.evaluate((els) => {
            return els.reduce<string[]>((agg, el) => {
              if (el) {
                const linkEl = el.nodeName === 'A' ? el : el.querySelector('a');
                if (linkEl) agg.push((linkEl as HTMLAnchorElement).href);
              }
              return agg;
            }, []);
          });

          itemsCount += links.length;

          // 5.4. Push new entries to the queue
          ctx.log.info(`008: Enqueuing ${links.length} (total: ${itemsCount}) new links from FB album (ID "${albumId}")`); // prettier-ignore
          await reqQueue.addRequests(links.map((url) => ({ url })));
          ctx.log.debug(`Done enqueuing ${links.length} (total: ${itemsCount}) new links from FB album (ID "${albumId}")`); // prettier-ignore

          if (outputMaxEntries != null && itemsCount > outputMaxEntries) stopFn();
        },
        { waitAfterScroll: waitAfterInfiniteScroll, scrollIntoView: (el) => scrollIntoView(el) }
      );
      ctx.log.info(`Finished infinite scroll for FB album (ID "${albumId}")`); // prettier-ignore

      // 6. Record the album entry
      const entry = {
        ...albumData,
        url: pageUrl,
        type: 'album',
        description,
        itemsCount,
      } satisfies FbAlbumPostEntry;

      await ctx.actor.pushData(entry, ctx, {
        privacyMask: {
          ownerFbid: () => true,
          ownerName: () => true,
          ownerUsername: () => true,
          ownerType: () => true,
          contributors: () => true,
        },
      });

      // TODO 7. Comments?
      //   - Use https://apify.com/apify/facebook-comments-scraper/input-schema
      //     - Commenter names are NOT included
    },
  } satisfies Record<FbGroupMediaRouteLabel, RouteHandler<Ctx, FbGroupMediaRouterContext>>;
};
