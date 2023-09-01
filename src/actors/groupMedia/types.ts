import { fromPairs } from 'lodash';
import type { CrawleeOneActorRouterCtx } from 'crawlee-one';
import type { PlaywrightCrawlingContext } from 'crawlee';

import type { ArrVal } from '../../utils/types';
import type { ImageMeta } from '../../utils/image';
import type { FbGroupMediaActorInput } from './config';

const enumFromArray = <T extends readonly any[]>(arr: T) => {
  return fromPairs(arr.map((k) => [k, k])) as { [Key in ArrVal<T>]: Key };
};

export const FB_GROUP_MEDIA_ROUTE_LABELS = [
  'FB_GROUP',
  'FB_GROUP_MEDIA',
  'FB_GROUP_MEDIA_TAB',
  'FB_MEDIA_ALBUM',
  'FB_MEDIA_PHOTO',
  'FB_MEDIA_VIDEO',
] as const;
export const FB_GROUP_MEDIA_ROUTE_LABEL_ENUM = enumFromArray(FB_GROUP_MEDIA_ROUTE_LABELS);
export type FbGroupMediaRouteLabel = ArrVal<typeof FB_GROUP_MEDIA_ROUTE_LABELS>;

export type FbGroupMediaRouterContext = CrawleeOneActorRouterCtx<
  PlaywrightCrawlingContext<Record<string, any>>,
  FbGroupMediaRouteLabel,
  FbGroupMediaActorInput
>;

export interface PostStats {
  likesCount: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  viewsCount: number | null;
}

export interface PostMetadata {
  description: string | null;
  authorFbid: string | null;
  authorName: string | null;
  authorProfileUrl: string | null;
}

export interface FbPhotoPostEntry extends PostStats, PostMetadata {
  type: 'photo';
  url: string;
  fbid: string | null;
  albumId: string | null;
  groupId: string | null;
  timestamp: string | null;
  authorProfileImageThumb: ImageMeta;
  imageFullSize: ImageMeta;
  imagePreview: ImageMeta & {
    alt: string | null;
  };
}

export interface FbVideoPostEntry extends PostStats, PostMetadata {
  type: 'video';
  url: string;
  videoId: string | null;
  fbid: string | null;
  /** ID of User who posted this video (if any) */
  userId: string | null;
  /** ID of FB Album this video belongs to (if any) */
  albumId: string | null;
  /** ID of FB Group this video belongs to (if any) */
  groupId: string | null;
  /** ISO of time posted */
  timestamp: string | null;
  videoUrl: string | null;
  videoTitle: string | null;
  videoDuration: number | null;
  videoHeight: number | null;
  videoWidth: number | null;
  videoThumbImage: ImageMeta & {
    alt: string | null;
  };
  authorProfileImageThumb: ImageMeta;

  /** Info about where was this post posted */
  postedToEntityFbid: string | null;
  /** Info about where was this post posted */
  postedToEntityName: string | null;
  /** Info about where was this post posted */
  postedToEntityUrl: string | null;
}

export interface FbAlbumPostEntry extends PostStats, Pick<PostMetadata, 'description'> {
  type: 'album';
  url: string;
  albumId: string | null;
  groupId: string | null;
  title: string | null;
  itemsCount: number | null;
  timestamp: string | null;
  ownerFbid: string | null;
  ownerName: string | null;
  ownerUsername: string | null;
  ownerType: string | null;
  contributors:
    | {
        fbid: string | null;
        name: string | null;
        url: string | null;
        profileImg: ImageMeta | null;
      }[]
    | null;
}
