import type { PlaywrightCrawlingContext } from 'crawlee';
import {
  type RouteHandler,
  type RouteMatcher,
  type DOMLib,
  cheerioDOMLib,
  playwrightHandleDOMLib,
  playwrightPageLib,
} from 'apify-actor-utils';
import { Actor } from 'apify';
import type { ElementHandle, JSHandle, Page } from 'playwright';

import { getSearchParams, removeSearchParams } from '../../utils/url';
import { wait } from '../../utils/async';
import { makeImageMeta } from '../../utils/image';
import type { MaybeArrayItems } from '../../utils/types';
import type {
  FbAlbumPostEntry,
  FbGroupMediaRouteLabel,
  FbGroupMediaRouterContext,
  FbPhotoPostEntry,
  FbVideoPostEntry,
} from './types';
import type { FbGroupMediaActorInput } from './config';
import { URL_REGEX } from './constants';
import { postDOMActions, postPageActions, postPageMethods } from './pageActions/post';

const makeCheerioDom = async (ctx: PlaywrightCrawlingContext, url: string | null) => {
  const cheerioDom = await ctx.parseWithCheerio();
  const domLib = cheerioDOMLib(cheerioDom.root(), url);
  return domLib;
};

const waitAfterInfiniteScroll = async (el: unknown, { page }: { page: Page }) => {
  await page.waitForLoadState('networkidle');
  await wait(1000);
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
      return !!urlObj.pathname.match(URL_REGEX.FB_GROUP_MEDIA_TAB_URL);
    },
  },
  {
    // Group media page
    // E.g. https://www.facebook.com/groups/185350018231892/media
    name: 'FB_GROUP_MEDIA',
    handlerLabel: 'FB_GROUP_MEDIA',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(URL_REGEX.FB_GROUP_MEDIA_URL);
    },
  },
  {
    // Group page
    // E.g. https://www.facebook.com/groups/185350018231892
    name: 'FB_GROUP',
    handlerLabel: 'FB_GROUP',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(URL_REGEX.FB_GROUP_URL);
    },
  },
  {
    // Album page
    // E.g. https://www.facebook.com/media/set/?set=oa.187284474705113
    name: 'FB_MEDIA_ALBUM',
    handlerLabel: 'FB_MEDIA_ALBUM',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(URL_REGEX.FB_ALBUM_URL);
    },
  },
  {
    // Photo page
    // E.g. https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
    name: 'FB_MEDIA_PHOTO',
    handlerLabel: 'FB_MEDIA_PHOTO',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(URL_REGEX.FB_PHOTO_URL);
    },
  },
  {
    // Video page
    // E.g. https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
    name: 'FB_MEDIA_VIDEO',
    handlerLabel: 'FB_MEDIA_VIDEO',
    match: (url) => {
      const urlObj = new URL(url);
      return !!urlObj.pathname.match(URL_REGEX.FB_VIDEO_URL);
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
      } = urlObj.pathname.match(URL_REGEX.FB_GROUP_URL) || { groups: {} as any }; // prettier-ignore
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
      } = new URL(pageUrl).pathname.match(URL_REGEX.FB_GROUP_MEDIA_URL) || { groups: {} as any }; // prettier-ignore

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
      } = new URL(url).pathname.match(URL_REGEX.FB_GROUP_MEDIA_TAB_URL) || { groups: {} as any }; // prettier-ignore

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
      const domLib = playwrightHandleDOMLib(bodyHandle, ctx.page);
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
          ctx.log.info(`Enqueuing ${links.length} (total: ${itemsCount}) new links to default request queue from "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore
          await reqQueue.addRequests(links.map((url) => ({ url })));
          ctx.log.debug(`Done enqueuing ${links.length} (total: ${itemsCount}) new links to default request queuefrom "${tab}" tab for FB group (ID "${groupId}")`); // prettier-ignore

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
      } = new URL(pageUrl).pathname.match(URL_REGEX.FB_GROUP_URL) || { groups: {} as any }; // prettier-ignore
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

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`002: Searching for payloads with post info`);
      const photoData = await postPageActions.getPhotoDataFromPayloads(ctx.page);

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
        const timestampRaw = await postPageActions.getPostTimestampValue(ctx.page, logger);
        logger.debug(`006: Normalising timestamp "${timestampRaw}"`);
        const timestamp = timestampRaw ? postPageMethods.parseFBTimestamp(timestampRaw) : null;
        photoData.timestamp = timestamp;
      }

      // 5. Get likes, comments, (and views for videos) counts
      logger.debug(`007: Extracting post stats`);
      // prettier-ignore
      if ([photoData.commentsCount, photoData.likesCount, photoData.commentsCount].some((d) => d == null)) {
        const domLib = await makeCheerioDom(ctx, pageUrl);
        const { likesCount, commentsCount, viewsCount } = await postDOMActions.getPostStats(domLib);
        if (likesCount != null) photoData.likesCount = likesCount;
        if (commentsCount != null) photoData.commentsCount = commentsCount;
        if (viewsCount != null) photoData.viewsCount = viewsCount;
      }

      // 6. Get authorName, authorProfileUrl, authorProfileImgUrl, post text
      logger.debug(`008: Finding post metadata element`);
      const domLib = await makeCheerioDom(ctx, pageUrl);
      const burgerMenuEl = await domLib.findOne('[aria-haspopup="menu"][role="button"]');
      const timestampEl = await postDOMActions.getPostTimestampEl(domLib);
      logger.debug(`009: Extracting post metadata`);
      const { authorProfileImageThumbUrl, description, ...postMetadata } = await postDOMActions.getAuthoredPostMetadata(timestampEl, burgerMenuEl, logger); // prettier-ignore
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

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`001: Searching for payloads with post info`);
      const videoData = await postPageActions.getVideoDataFromPayloads(ctx.page);

      // 2. Get parent Album and fbid from URL
      // E.g. `/photo/?fbid=10150775445404199&set=oa.187284474705113`
      logger.debug(`002: Extracting data from URL`);
      if ([videoData.albumId, videoData.fbid, videoData.userId, videoData.videoWidth].some((d) => d == null)) {
        const { set: albumId, fbid } = getSearchParams(url, ['set', 'fbid']);
        const urlRegex = new URL(url).pathname.match(URL_REGEX.FB_VIDEO_URL);
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
        const timestampRaw = await postPageActions.getPostTimestampValue(ctx.page, logger);
        logger.debug(`005.1: Normalising timestamp "${timestampRaw}"`);
        const timestamp = timestampRaw ? postPageMethods.parseFBTimestamp(timestampRaw) : null;
        videoData.timestamp = timestamp;
      } // prettier-ignore

      // 6. Get likes, comments, (and views for videos) counts
      logger.debug(`006: Extracting post stats`);
      if ([videoData.videoUrl, videoData.videoDuration, videoData.videoHeight, videoData.videoWidth].some((d) => d == null)) {
        domLib = await makeCheerioDom(ctx, url);
        const { likesCount, commentsCount, sharesCount, viewsCount } = await postDOMActions.getPostStats(domLib);
        if (videoData.likesCount == null) videoData.likesCount = likesCount;
        if (videoData.commentsCount == null) videoData.commentsCount = commentsCount;
        if (videoData.sharesCount == null) videoData.sharesCount = sharesCount;
        if (videoData.viewsCount == null) videoData.viewsCount = viewsCount;
      } // prettier-ignore

      // 7. Get authorName, authorProfileUrl, authorProfileImgUrl, post text
      logger.debug(`007: Finding post metadata element`);
      const menuEl = (await domLib.findMany('[aria-label="More"][role="button"]')).slice(-1)[0];
      const timestampEl = await postDOMActions.getPostTimestampEl(domLib);
      logger.debug(`008: Extracting post metadata`);
      const { authorProfileImageThumbUrl, description, ...postMetadata } = await postDOMActions.getAuthoredPostMetadata(timestampEl, menuEl, logger); // prettier-ignore
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

      // 1. To speed up processing, try to get metadata JSONs available on the page
      logger.debug(`001: Searching for payloads with post info`);
      const albumData = await postPageActions.getAlbumDataFromPayloads(ctx.page);
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
      const { description } = await postDOMActions.getAlbumPostMetadata(chDom);

      // 3. Get timestamp
      logger.debug(`003: Extracting post timestamp (ID "${albumId}")`);
      if (!albumData.timestamp) {
        const timestampRaw = await postPageActions.getPostTimestampValue(ctx.page, logger);
        logger.debug(`003.1: Normalising timestamp "${timestampRaw}" (ID "${albumId}")`);
        const timestamp = timestampRaw ? postPageMethods.parseFBTimestamp(timestampRaw) : null;
        albumData.timestamp = timestamp;
      }

      // 4. Get likes, comments, (and views for videos) counts
      // NOTE: We regenerate domLib bc we interacted with page in previous step
      logger.debug(`004: Extracting post stats (ID "${albumId}")`);
      if ([albumData.likesCount, albumData.sharesCount, albumData.commentsCount, albumData.viewsCount].some((d) => d == null)) {
        chDom = await makeCheerioDom(ctx, pageUrl);
        const { commentsCount, likesCount, sharesCount, viewsCount } = await postDOMActions.getPostStats(chDom);
        if (albumData.likesCount == null) albumData.likesCount = likesCount;
        if (albumData.commentsCount == null) albumData.commentsCount = commentsCount;
        if (albumData.sharesCount == null) albumData.sharesCount = sharesCount;
        if (albumData.viewsCount == null) albumData.viewsCount = viewsCount;
      } // prettier-ignore

      // 5. Get all entries in the album
      // 5.1. Find container of entries loaded via infinite scroll
      ctx.log.debug(`005: Looking for infinite scroll container for FB album (ID "${albumId}")`);
      const pwPage = await playwrightPageLib(ctx.page);
      const pwDom = playwrightHandleDOMLib(await ctx.page.evaluateHandle(() => document), ctx.page);
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
