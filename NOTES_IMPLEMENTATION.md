# Flow for FB groups media

TODO: Can I and SHOULD I save the IMAGES as blob via Apify? Or should I save them in buckets?
TODO: Can I save the VIDEOS as blob via Apify? (PROBS NOT, TOO LARGE) Or should I save them in buckets? (PROBS NOT, TOO LARGE)

1. Enter group URL

   - E.g. `https://www.facebook.com/groups/185350018231892`

2. Add group URL to queue

3. Handle queue

   - ON GROUP URL

     - e.g. `https://www.facebook.com/groups/185350018231892`

     1. Go to `/media`
        - e.g. `https://www.facebook.com/groups/185350018231892/media`
     2. Handle as GROUP MEDIA URL

   - ON GROUP MEDIA URL

     - e.g. `https://www.facebook.com/groups/185350018231892/media`

     1. Define whether to go over photos, videos, or albums (or all tabs)

        - Photos tab - `[href*="/photos/"][role="tab"]`
        - Videos tab - `[href*="/videos/"][role="tab"]`
        - Albums tab - `[href*="/albums/"][role="tab"]`

     2. For each tab, get resource link (photo, video, album)

        1. Click on tab

        2. Scroll down

           - If can scroll again, scroll again, and again, and again, until we reach the end

        3. Get all links elements

           - Photo links - `[href*="/photo/"][role="link"]`
           - Video links - `[href*="/videos/"][role="link"]`
           - Albums links - `[href*="/set/"][role="link"]`

        4. Get element data

           - link - `el.href`
           - thumbnail URL - `el.querySelector('img').src`
           - thumbnail alt text - `el.querySelector('img').alt`
           - [ALBUM ONLY]
             - Album name - `[...el.querySelectorAll('span')].map(el => el.textContent).filter(Boolean)[0]`
             - Album count - `[...el.querySelectorAll('span')].map(el => el.textContent).filter(Boolean)[1]` - NOTE: you get something like `1 photo`

        5. Add parsed resources to queue

   - ON PHOTO URL

     - E.g. `https://www.facebook.com/photo/?fbid=10152026359419698&set=g.185350018231892`

     1. Get full-size photo URL

        1. Click on burger menu
           - `[aria-haspopup="menu"][role="button"]`
           - `el.click()`
        2. Get download link from "Download" button
           - `[download][role="menuitem"]`
           - `el.href`
             - e.g. `https://scontent.fbts9-1.fna.fbcdn.net/v/t1.18169-9/943215_10152026359419698_1217123876_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=5bac3a&_nc_ohc=XOJrEHxMTNQAX8hxfRO&_nc_ht=scontent.fbts9-1.fna&oh=00_AfCG9L7cPi_ljSl8ehI6H5lIbgl3LX7TdD9TgHJ2l6U66A&oe=64DE41D6&dl=1`
        3. Remove "dl=1" query param from the link
           - e.g. `https://scontent.fbts9-1.fna.fbcdn.net/v/t1.18169-9/943215_10152026359419698_1217123876_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=5bac3a&_nc_ohc=XOJrEHxMTNQAX8hxfRO&_nc_ht=scontent.fbts9-1.fna&oh=00_AfCG9L7cPi_ljSl8ehI6H5lIbgl3LX7TdD9TgHJ2l6U66A&oe=64DE41D6`
        4. TODO - Can I save the IMAGES as blob via Apify? Or should I save them in buckets?

     2. Get medium photo URL

        - `[data-pagelet="MediaViewerPhoto"] img`
          - TODO - is this different for VIDEO and ALBUM?
        - `el.src`
        - `el.alt`

     3. Get timestamp

        ```js
        const timestampLoc = page
          .locator('[aria-label]') // Matches about 20 els
          // Match text like "June 24, 2013"
          .filter({ hasText: /[a-z]+\s+\d{1,2}[,\s]+\d+/i })
          .first();
        await timestampLoc.hover(); // https://stackoverflow.com/a/73610985

        const tooltipLoc = page.locator('[role="tooltip"]');
        await tooltipLoc.waitFor();
        // We get something like "Monday, June 24, 2013 at 5:20 PM"
        return (await tooltipLoc.textContent()).trim();
        ```

        ```js
        // Monday, June 24, 2013 at 5:20 PM
        parseFBTimestamp = (timestampStr) => {
          const normTimestampStr = timestampStr.trim().replace(/\s+/g, ' ');
          const {
            groups: { month, dayOfMonth, year, hour, minute, ampm },
          } = timestampStr.match(
            /^(?<day>[a-z]+)[\s,]+(?<month>[a-z]+)[\s,]+(?<dayOfMonth>\d+)[\s,]+(?<year>\d+)[\D\s,]+(?<hour>\d+)[\s:]+(?<minute>\d+)[\s,]+(?<ampm>[a-z]+)/
          ) || { groups: {} };

          // Convert month from text to numeric
          const parsedMonth = padLeft(dateFns.parse('MMMM', month).getMonth().getMonth() + 1, '0');
          const hourAdjusted = ampm.toLowerCase().includes('pm')
            ? Number.parseInt(hour) + 12
            : hour;
          const timestamp = `${year}‐${parsedMonth}‐${dayOfMonth}T${hourAdjusted}:${minute}:00Z`;
          return timestamp;
        };
        ```

     4. Get likes, comments, (and views for videos) counts

        ```js
        getCommonAncestor = (el1, el2) => {
         // https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
         const { firstEl, lastEl } = el1.compareDocumentPosition(el2) & Node.DOCUMENT_POSITION_FOLLOWING
            ? { firstEl: el1, lastEl: el2 }
            : { firstEl: el2, lastEl: el1 };

          // https://stackoverflow.com/a/25154092
          // https://developer.mozilla.org/en-US/docs/Web/API/Range/commonAncestorContainer
          const range = new Range();
          range.setStartBefore(firstEl);
          range.setEndAfter(lastEl);
          const containerEl = range.commonAncestorContainer;
          return containerEl;
        };

        /**
         * Handles extracting stats from:
         * - Albums - https://www.facebook.com/media/set/?set=oa.186299054803655&type=3
         *          - https://www.facebook.com/media/set/?set=oa.187284474705113
         * - Photos - https://www.facebook.com/photo/?fbid=10150775445404199&set=oa.187284474705113
         *          - https://www.facebook.com/photo/?fbid=1384528728428950&set=g.185350018231892
         * - Videos - https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892
         */
        getPostStats = () => {
          // PART 1: FIND CONTAINER WITH POST STATS
          const likesEl = document.querySelector('[aria-label*="Like:"]');
          const commentsEl = [...document.querySelectorAll('[role="button"] [dir="auto"]')].find(
            (el) => el.textContent.trim().match(/[\d,.]+(?:\s+comment)?/i)
          );

          let statsContainerEl = null;
          if (likesEl && commentsEl) {
            statsContainerEl = getCommonAncestor(likesEl, commentsEl);
          }

          // PART 2: EXTRACT INFO

          let likesCount = null;
          if (likesEl) {
            // "Like: 24 people"
            const likesText = likesEl ? likesEl.ariaLabel.trim() : 'like: 0';
            // "24" possibly also "2,400"
            const {
              groups: { likes },
            } = likesText.match(/like.*?(?<likes>[\d,.]+)/i) || { groups: {} };
            likesCount = likes ? Number.parseFloat(likes.replace(/[,\s]+/g, '')) : 0;
          }

          let commentsCount = null;
          if (commentsEl) {
            // "1 comment" or "6 comments", possibly "6,000 comments"
            const {
              groups: { comments },
            } = commentsEl.textContent.trim().match(/(?<comments>[\d,.]+)(?:\s+comment)?/i) || {
              groups: {},
            };
            commentsCount = comments ? Number.parseFloat(comments.replace(/[,\s]+/g, '')) : 0;
          }

          let viewsCount = null;
          if (statsContainerEl) {
            const viewsEl = [...statsContainerEl.children].find((el) =>
              el.textContent.trim().match(/views/i)
            );
            if (viewsEl) {
              // "6.9K views"
              const {
                groups: { views, viewsUnit },
              } = (viewsEl &&
                viewsEl.textContent
                  .trim()
                  .toLowerCase()
                  .match(/(?<views>[\d,.]+)\s*(?<viewsUnit>[kmb])/i)) || { groups: {} };
              const viewsNum = views ? Number.parseFloat(views.replace(/[,\s]+/g, '')) : 0;
              const viewsUnitMultiples = { k: 1000, m: 10 ** 6, b: 10 ** 9, t: 10 ** 12 };
              const viewsMulti = viewsUnitMultiples[viewsUnit] || 1;
              viewsCount = viewsNum * viewsMulti;
            }
          }

          return {
            likesCount,
            commentsCount,
            viewsCount,
          };
        };
        ```

     5. Get authorName, authorProfileUrl, authorProfileImgUrl, post text

        ```js
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
        getAuthoredPostMetadata = (endEl) => {
          // PART 1: FIND CONTAINER WITH POST METADATA
          const timestampEl = getPostTimestampEl();
          if (!endEl || !timestampEl) return;

          const metadataContainerEl = getCommonAncestor(timestampEl, endEl);

          // PART 2: GET AUTHOR INFO
          const authorContainerEl = metadataContainerEl.children[0];
          const authorProfileImgThumbEl = authorContainerEl ? authorContainerEl.querySelector('image') : null;
          const authorProfileLinkEl = authorProfileImgThumbEl ? authorProfileImgThumbEl.closest('a') : null;

          const authorProfileImgThumbUrl = authorProfileImgThumbEl ? authorProfileImgThumbEl.href.baseVal : null;
          const authorName = authorProfileLinkEl ? authorProfileLinkEl.ariaLabel.trim() : null;
          const authorProfileUrlRaw = authorProfileLinkEl ? authorProfileLinkEl.attributes.href.value : null;
          const authorProfileUrl =
            !authorProfileUrlRaw || authorProfileUrlRaw === '#'
              ? null
              : authorProfileLinkEl.href.trim();

          // PART 3: GET POST TEXT
          // NOTE: We find the post description by finding the element that contains both the known elements
          //       AND the description. Known elements are BEFORE the description, so we "subtract"
          //       it from the joint text.
          const metadataText = metadataContainerEl.textContent.trim();
          const metadataPlusDescText = metadataContainerEl.parentElement.textContent;
          const description = metadataPlusDescText.split(metadataText)[1].trim();
          // TODO - DO we need to handle the "See more"?

          return {
            description,
            authorName,
            authorProfileUrl,
            authorProfileImgThumbUrl,
          };
        };

        const burgerMenuEl = document.querySelector('[aria-haspopup="menu"][role="button"]');
        getAuthoredPostMetadata(burgerMenuEl);
        ```

     6. Image size?

        - I think I already wrote helper for that for amazon scraper.

      7. Get parent Album and fbid from URL
         ```js
         // photo/?fbid=10150775445404199&set=oa.187284474705113
         const urlObj = new URL(globalThis.location);
         const albumId = urlObj.searchParams.get('set');
         const fbId = urlObj.searchParams.get('fbid');
         ```

      8. Get comment info
        - Use https://apify.com/apify/facebook-comments-scraper/input-schema
          - Commenter names are NOT included

   - ON VIDEO URL

     - E.g. `https://www.facebook.com/milo.barnett/videos/10205524050998264/?idorvanity=185350018231892`

     1. Get video URL

        - `[data-pagelet="WatchPermalinkVideo"] video`

        ```js
        const videoEl = document.querySelector('[data-pagelet="WatchPermalinkVideo"] video');
        return {
          videoUrl: videoEl.src,
          videoDuration: videoEl.duration,
          height: videoEl.videoHeight,
          width: videoEl.videoWidth,
        };
        ```

        TODO

        - Can I save the VIDEOS as blob via Apify? (PROBS NOT, TOO LARGE)
          - Or should I save them in buckets? (PROBS NOT, TOO LARGE)
        - VIDEO CONTENT TYPE?

     2. Get video thumb photo

        - `[data-pagelet="WatchPermalinkVideo"] img`
        - `el.src`
        - `el.alt`
        - ContentType, size and dimensions? (See `getImgMeta`)

     3. Get timestamp

        - USE THE SAME AS FOR PHOTOS

     4. Get likes, comments, views count

        - USE THE SAME AS FOR PHOTOS

     5. Get authorName, authorProfileUrl, authorProfileImgUrl, post text

        ```js
        const menuEl = [...document.querySelectorAll('[aria-label="More"][role="button"]')].slice(
          -1
        )[0];
        getAuthoredPostMetadata(menuEl);
        ```

      6. Get parent Album and fbid from URL
         ```js
         // photo/?fbid=10150775445404199&set=oa.187284474705113
         const urlObj = new URL(globalThis.location);
         const albumId = urlObj.searchParams.get('set');
         const fbId = urlObj.searchParams.get('fbid');
         ```

     7. Get comment info
        - Use https://apify.com/apify/facebook-comments-scraper/input-schema
          - Commenter names are NOT included

   - ON ALBUM COLLECTION URL

     - E.g. `https://www.facebook.com/groups/185350018231892/media/albums/`

     1. Scroll all the way down and get all links along the way

     ```js
     // Load entries via infinite scroll and process them as you go
     const infiniteScrollLoader = ({
        container,
        onNewResults,
        childrenCounter = (el) => el.childElementCount,
        childrenGetter = (el) => el.children,
        scrollIntoView = (el) => el.scrollIntoView,
        waitAfterScroll = (el) => waitForNetworkIdle(), // await new Promise((res) => setTimeout(res, 3000));
     }) => {
        const containerElGetter = typeof container === 'function' ? container : () => container;

        const processedChildren = new Set();

        const processChildren = async (childrenEl) => {
           const newChildren = await childrenEl.filter((el) => !processedChildren.has(el));
           await onNewResults(newChildren);
           newChildren.forEach((el) => processedChildren.add(el));
        };

        let currChildrenCount = await childrenCounter(await containerElGetter());
        while (true) {
           // Process currently-loaded children
           const containerEl = await containerElGetter();
           const currChildren = [...(await childrenGetter(container))];
           await processChildren(currChildren);

           // Load next batch
           const lastChildEl = currChildren.slice(-1)[0];
           await scrollIntoView(lastChildEl);
           await waitAfterScroll();
           const newChildrenCount = await childrenCounter(container);

           if (newChildrenCount <= currChildrenCount) break;

           currChildrenCount = newChildrenCount;
        }
     };

     const albumEls = [...document.querySelectorAll('[href*="/set/"][role="link"]')];
     let albumsContainerEl = albumEls[0] ? albumEls[0].parentELement : null;
     if (albumEls.length >= 2) {
         albumsContainerEl = getCommonAncestor(albumEls[0], albumEls[1]);
     }

     await infiniteScrollLoader({
        container: albumsContainerEl,
        onNewResults: async (els) => {
           for (const el of els) {
               const linkEl = el.nodeName === 'A' ? el : el.querySelector('a');
               if (!linkEl.href) continue;
               await pushToQueue(linkEl.href);
           }
        },
     });
     ```

   - ON ALBUM (SET) URL

     - E.g. `https://www.facebook.com/media/set/?set=oa.187284474705113&type=3`

     1. Get album metadata
        ```js
         getPostTimestampEl = () => {
           const timestampEl = [...document.querySelectorAll('[aria-label]')] // Matches about 20 els
               // Match text like "June 24, 2013"
               .find((el) => el.textContent.trim().match(/[a-z]+\s+\d{1,2}[,\s]+\d+/i));
           return timestampEl;
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
        getAlbumMetadata = () => {
          // PART 1: FIND CONTAINER WITH POST METADATA
          const timestampEl = getPostTimestampEl();
          const albumsLinkEl = document.querySelector('[href*="/media/albums"][role="link"]');
          if (!albumsLinkEl || !timestampEl) return;

          const metadataContainerEl = getCommonAncestor(albumsLinkEl, timestampEl);

          // PART 3: GET POST TEXT
          // NOTE: We find the post description by finding the element that contains both the known elements
          //       AND the description. Known elements are BEFORE the description, so we "subtract"
          //       it from the joint text.
          const metadataText = metadataContainerEl.textContent.trim();
          const albumsLinkText = albumsLinkEl.textContent.trim();
          const timestampText = timestampEl.textContent.trim();
          const description = metadataText.split(albumsLinkText)[1] // Remove preceding text
            .split(timestampText)[0] // Remove trailing text
            .split('·').slice(0, -1).join('.').trim(); // Clean up leftover artifacts

          // TODO - DO we need to handle the "See more"?

          return {
            description,
          };
        };
       ```

     2. Get timestamp
        - USE THE SAME AS FOR PHOTOS

      3. Get likes, comments, (and views for videos) counts
         - USE THE SAME AS FOR PHOTOS

      4. Record entry
      ```js
         const albumId = (new URL(globalThis.location)).searchParams.get('set');
         pushData({
            ...otherData,
            type: 'Album',
            id: albumId,
            url: globalThis.location,
         });
      ```

      5. Get all entries in the album
         ```js
         const itemEls = [...document.querySelectorAll('[role="listitem"] [href][role="link"]')];
         let containerEl = itemEls[0] ? itemEls[0].parentELement : null;
         if (itemEls.length >= 2) {
            containerEl = getCommonAncestor(itemEls[0], itemEls[1]);
         }

         await infiniteScrollLoader({
            container: containerEl,
            onNewResults: async (els) => {
               for (const el of els) {
                  const linkEl = el.nodeName === 'A' ? el : el.querySelector('a');
                  if (!linkEl.href) continue;
                  await pushToQueue(linkEl.href);
               }
            },
         });
         ```

      6. Get comment info
        - Use https://apify.com/apify/facebook-comments-scraper/input-schema
          - Commenter names are NOT included
