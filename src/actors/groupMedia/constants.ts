// NOTE: Complex regexes are defined in top-level scope, so any syntax errors within them
//       are captured during initialization.
export const URL_REGEX = {
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
