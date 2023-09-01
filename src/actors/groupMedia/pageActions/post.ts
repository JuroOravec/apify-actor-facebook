import { playwrightLocatorPortadom, type Portadom } from 'portadom';
import { parse as parseDate, format as formatDate } from 'date-fns';
import type { Page } from 'playwright';
import type { Log } from 'crawlee';

import { serialAsyncMap } from '../../../utils/async';
import { imageMeta, makeImageMeta } from '../../../utils/image';
import { URL_REGEX } from '../constants';
import type { FbAlbumPostEntry, FbPhotoPostEntry, FbVideoPostEntry, PostStats } from '../types';
import { generalPageActions } from './general';

///////////////////////
// PAGE ACIONS
///////////////////////

export const postPageActions = {
  getPostTimestampValue: async (page: Page, parentLogger?: Log) => {
    const logger = parentLogger?.child({ prefix: 'getPostTimestamp_' });

    // 1. Hover over the date of posting to reveal a tooltip with more detailed timestamp
    logger?.debug('001: Finding timestamp element.');
    const dom = playwrightLocatorPortadom(page.locator('body'), page);
    const timestampLoc = await postDOMActions.getPostTimestampEl(dom);
    if (!timestampLoc?.node) {
      logger?.debug('Failed to find the timestamp element.');
      return null;
    }

    logger?.debug('002: Hovering the timestamp element.');
    await timestampLoc?.node?.hover({ force: true }); // https://stackoverflow.com/a/73610985

    // 2. Extract the timestmap from the tooltip
    logger?.debug('003: Waiting for tooltip with detailed timestamp.');
    const tooltipLoc = page.locator('[role="tooltip"]');
    await tooltipLoc.waitFor();
    const tooltipDom = playwrightLocatorPortadom(tooltipLoc, page);
    // We get something like "Monday, June 24, 2013 at 5:20 PM"
    const fbTimestamp = await tooltipDom.text();
    return fbTimestamp;
  },

  getAlbumDataFromPayloads: async (page: Page) => {
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

    const [rawAlbumPayload] = await generalPageActions.searchFbPayloads(page, albumFilter, { prefilter }); // prettier-ignore
    const [rawStatsPayload] = await generalPageActions.searchFbPayloads(page, statsFilter, { prefilter }); // prettier-ignore

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
  },

  getVideoDataFromPayloads: async (page: Page) => {
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

    const [rawPageInfoPayload] = await generalPageActions.searchFbPayloads(page, pageInfoFilter, { prefilter }); // prettier-ignore
    const [rawVideoPayload] = await generalPageActions.searchFbPayloads(page, videoFilter, { prefilter }); // prettier-ignore
    const [rawAuthorPayload] = await generalPageActions.searchFbPayloads(page, authorFilter, { prefilter }); // prettier-ignore
    const [rawCommentPayload] = await generalPageActions.searchFbPayloads(page, commentFilter, { prefilter }); // prettier-ignore
    const [rawStatsPayload] = await generalPageActions.searchFbPayloads(page, statsFilter, { prefilter }); // prettier-ignore

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
      authorSecs.metadata.find((d: any) => d?.story?.creation_time)?.story?.creation_time ?? null;
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
  },

  getPhotoDataFromPayloads: async (page: Page) => {
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
    const [rawPhotoPayload] = await generalPageActions.searchFbPayloads(page, photoFilter, { prefilter }); // prettier-ignore
    const [rawStatsPayload] = await generalPageActions.searchFbPayloads(page, statsFilter, { prefilter }); // prettier-ignore
    const [rawAuthorPayload] = await generalPageActions.searchFbPayloads(page, authorFilter, { prefilter }); // prettier-ignore

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
  },
};

///////////////////////
// DOM ACIONS
///////////////////////

export const postDOMActions = {
  getPostTimestampEl: async <T extends unknown>(dom: Portadom<T, any>) => {
    const timestampEl = await dom
      .findMany('[aria-label]') // Matches about 20 els
      .findAsyncSerial(async (el) => {
        const text = await el.text();
        // Match text like "June 24, 2013"
        return text?.match(URL_REGEX.TIMESTAMP_DATE);
      }).promise;
    return timestampEl;
  },

  /**
   * Handles extracting stats from:
   * - Albums - https://www.facebook.com/media/set/?set=oa.186299054803655&type=3
   *          - https://www.facebook.com/media/set/?set=oa.187284474705113
   * - Photos - https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
   *          - https://www.facebook.com/photo/?fbid=1384528728428950&set=g.185350018231892
   * - Videos - https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
   */
  getPostStats: async <T extends unknown>(dom: Portadom<T, any>) => {
    // 1. Find container with post stats
    const likesEl = await dom.findOne('[aria-label*="Like:"]').promise;
    const commentsEl = await dom
      .findMany('[role="button"] [dir="auto"]')
      .findAsyncSerial(async (el) => {
        const text = await el.text();
        return text?.match(URL_REGEX.COMMENT_COUNT);
      }).promise;

    const statsContainerEl =
      likesEl?.node && commentsEl?.node
        ? await likesEl.getCommonAncestor(commentsEl.node).promise
        : null;
    // "6.9K views"
    const viewsText = await statsContainerEl
      ?.children()
      .findAsyncSerial(async (domEl) => {
        const text = await domEl.text();
        return text?.match(/views/i);
      })
      .textAsLower();

    // 2. Extract likes
    let likesCount: number | null = null;
    if (likesEl) {
      // "Like: 24 people"
      const likesText = (await likesEl.prop<string | null>('aria-label')) ?? 'like: 0';
      // "24" possibly also "2,400"
      const regexRes = likesText.match(URL_REGEX.LIKE_COUNT);
      const { groups: { likes } } = regexRes || { groups: {} as any }; // prettier-ignore
      likesCount = likes ? Number.parseFloat(likes.replace(/[,\s]+/g, '')) : 0;
    }

    // 3. Extract comments
    let commentsCount: number | null = null;
    if (commentsEl) {
      // "1 comment" or "6 comments", possibly "6,000 comments"
      const commentsText = await commentsEl.text();
      // "1" possibly also "6,000"
      const regexRes = commentsText?.match(URL_REGEX.COMMENT_COUNT);
      const { groups: { comments } } = regexRes || { groups: {} as any }; // prettier-ignore
      commentsCount = comments ? Number.parseFloat(comments.replace(/[,\s]+/g, '')) : 0;
    }

    // 4. Extract views
    let viewsCount: number | null = null;
    if (statsContainerEl) {
      // "6.9K views"
      const viewsText = await statsContainerEl
        .children()
        .findAsyncSerial(async (domEl) => {
          const text = await domEl.text();
          return text?.match(/views/i);
        })
        .textAsLower();

      const regexRes = viewsText?.match(URL_REGEX.VIEW_COUNT);
      const { groups: { views, viewsUnit } } = regexRes || { groups: {} as any }; // prettier-ignore
      // Convert "6.9K" to `6900`
      const viewsNum = views ? Number.parseFloat(views.replace(/[,\s]+/g, '')) : 0;
      const viewsUnitMultiples = { k: 1000, m: 10 ** 6, b: 10 ** 9, t: 10 ** 12 };
      const viewsMulti = (viewsUnitMultiples as any)[viewsUnit] || 1;
      viewsCount = viewsNum * viewsMulti;
    }

    return {
      likesCount,
      commentsCount,
      viewsCount,
      sharesCount: null,
    } satisfies PostStats;
  },

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
  getAuthoredPostMetadata: async <T extends unknown>(
    timestampEl: Portadom<T, any> | null,
    endEl: Portadom<T, any> | null,
    prentLog?: Log
  ) => {
    const logger = prentLog?.child({ prefix: 'AuthoredPostMetadata_' });
    // 1. Find container with post metadata by "triaging" it as a common ancestor
    //    of a timestamp element (which is present in all cases), and another one.
    //    The second element changes on different layouts, so we have to provide it
    //    from the outside.
    logger?.debug('001: Finding metadata container');
    const metadataContainerEl =
      endEl?.node && timestampEl?.node
        ? await timestampEl.getCommonAncestor(endEl.node).promise
        : null;

    // 2. Get author info
    logger?.debug('002: Finding elements within metadata container');
    const authorProfileImgThumbEl = metadataContainerEl?.children().at(0).findOne('image');
    const authorProfileLinkEl = authorProfileImgThumbEl?.closest('a');

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
    const metadataPlusDescText = (await metadataContainerEl?.parent().text()) ?? null;
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
  },

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
  getAlbumPostMetadata: async <T extends unknown>(dom: Portadom<T, any>) => {
    // 1. Find container with post metadata
    const timestampEl = await postDOMActions.getPostTimestampEl(dom);
    const albumsLinkEl = await dom.findOne('[href*="/media/albums"][role="link"]').promise;

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
  },
};

///////////////////////
// HELPERS
///////////////////////

export const postPageMethods = {
  /**
   * Parse the timestamp formatted by Facebook into ISO timestamp.
   *
   * From:
   * "Monday, June 24, 2013 at 5:20 PM"
   *
   * To:
   * "2013-06-24T17:20:00Z"
   */
  parseFBTimestamp: (timestampStr: string) => {
    const normTimestampStr = timestampStr.trim().replace(/\s+/g, ' ');

    // Parse text into time units
    const regexRes = normTimestampStr.match(URL_REGEX.TIMESTAMP_DATETIME);
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
  },
};
