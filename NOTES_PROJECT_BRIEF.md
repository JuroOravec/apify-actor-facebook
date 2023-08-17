# Web Scraping Assessment

## Criteria

Have a Excel Dataset with each row being one image

- column1: Timestamp of post (Year, Month, Date, Hour)
- column2: Number of Likes
- column3: Number of Comments
- column4: Link to image (if image)
- column5: any text that post/image contains
- columnsX: - what other data is available on each photo / post?

## Scope of work

1. Could you test the feasibility of this apify marketplace product for the goal above?

- https://apify.com/apify/facebook-groups-scraper
- https://apify.com/apify/facebook-photos-scraper

---

- It is feasible
- Col1-5 supported
- Extra info:
  - `ocrText`
  - img size
  - comments data:
    - date
    - text
    - profilePictureUrl
    - likesCount
- Commenter names are NOT included

2. If it is feasible, could you use the apify marketplace product for the goal above, then show me how it works?

- Yup, will show you how it works :)

1. Create a profile via https://www.apify.com?fpr=vhtgl
2. Start free trial for Facebook Groups Scraper at https://apify.com/apify/facebook-groups-scraper#startUrls
3. In input set the group URL as `startUrls`


    ```json
    { "startUrls": ["https://www.facebook.com/groups/185350018231892"] }
    ```

4. Set to use residential proxy
5. Click Save & Run
6. It should start scraping the group
7. Once done, you can download as JSON or CSV
8. Optionally, I can modify the output data (eg separate table for comments)
   so it can be opened in spreadsheets.

9. If it is not feasible, could you build an apify scraper for the needs of the goal above?

- N/A

## Questions

1. How would the access work? I imagine you need to be able to access the group.

- The group photos are actually publically available
  - See this URL in incognito
    - https://www.facebook.com/photo/?fbid=4363572466120&set=g.185350018231892

2. It seems like there are a ton of apify products our there. Do you have any use-cases in mind you want to start with? Just wondering, once I saw how many there are for all the major internet platforms; it might be a bit harded to find a niche.

- Good point, you're right, e.g. Facebook scrapers are almost exclusively managed by Apify.
- And yes, I'm still drawn to research / science / enviro issues, so I want to offer my services to businesses in that niche.

3. I haven't seen any apify products related to "non-western" platforms like the chinese weChat, Korean Naver (Google), russian Vkontakte (facebook) - could be a gap!

- Nice! I'm not familiar with them, but worth googling around if people are trying to scrape them 👀🙏

4. How much time / money do you estimate the scope of work to be? I have a budget of around 500-600 EUR.

- Since I don't have to build anything, nor buy the scrapers, let's keep it free.
- Would you write a recommendation that I could put on the web? 0:)
- And secondly, I want to put pro bono section on the web, because what you mentioned about Lurdska jaskyna was super interesting. So just a request that when you finish the (e)book, that I could post about it :D

## Thoughts

Context: Scraping images of public or archived FB group

- Scraping options

  1. [NO] In-browser script

  - pros
    - Quickly deployed
  - cons
    - data doesn't include comments, num of likes, authors, etc
    - manual navigation not desirable (1000+ photos)
    - automatic navigation might not work bc

  2. [NO] Browser-emulating script

  - For context

    1. Open URL https://www.facebook.com/photo/?fbid=4363572466120&set=g.185350018231892
    2. Open devtools. Go to Network tab
    3. Reload page
    4. Find request to https://www.facebook.com/api/graphql/
       where payload contains
       `fb_api_req_friendly_name: CometPhotoRootContentQuery`

  - pros
  - cons
    - very complex, FB sends A LOT of data, and finding results there is not easy
    - albeit fast, it would take 2-3 days to emulate that

  3. [MAYBE] Browser automation

  - pros

    - Data already formatted the way it's easy to read for us
    - Comments, authors, likes, high-res img

  - neutral

    - might need to wait for high-res img to load (or intercept request to know that?)
      - But we can open menu > and the "Download" contains link to the high-res img

  - cons
    - Comment timestamp could be a bit tricky, but I can get it with
      `aria-describedby="X"` when hovering over timestamp, and then the tooltip
      that contains the timestamp with `[id="X"]`, where `X` can be `:r1l:`
    - Doesn't include WHO liked, only count (enabled if logged in)
    - Can get commentor names, but not links to their profiles (enabled if logged in)

  4. [NO] Official API

  - [NO] Facebook Groups API
    - No good - [...] an app can only access group posts published after the app was installed on the group.
      - See https://developers.facebook.com/docs/groups-api/overview
    - Also needs admins to add the app to the group
      See https://www.facebook.com/help/261149227954100
  - [NO] Graph API (Using app token)
    - App token wouldn't see the authors' names
      - See https://stackoverflow.com/questions/69851873/facebook-groups-access-member-info-problem
    - Nor comments, even with user token
      - See https://developers.facebook.com/docs/graph-api/reference/v16.0/object/comments#readmodifiers
    - Docs
      - https://developers.facebook.com/docs/graph-api/reference/group/#readperms
      - https://developers.facebook.com/docs/graph-api/overview
      - https://developers.facebook.com/docs/facebook-login/guides/access-tokens
      - https://developers.facebook.com/docs/graph-api/get-started
      - https://developers.facebook.com/docs/permissions/reference/groups_access_member_info_description/

  5. [YES] Existing scraper(s)
  1. Get all posts using Facebook groups scraper


      - https://apify.com/apify/facebook-groups-scraper
      - Note: I need a residential proxy

  2. Download the dataset
     <!-- NOT NEEDED - The Facebook groups scraper already includes comments -->
     <!-- 3. Get Photo URLs from the dataset


      - Output contains `attachments` field (array) which optionally
        contains photo objects:

          ```json
            "__typename": "Photo"
            "url": "https://www.facebook.com/photo.php?fbid=916459069665283&set=gm.6265992516811037&type=3",
          ```

  4. Get all photos using Facebook photo scraper -->

  5. Custom scraper

  - Would be costly compared to the Facebook groups scraper

## Checklist

1. Dataset identification

   - [ ] 1.1 Identify distinct types of web pages and the data of interest

     - 2 types:
       - Listing - https://www.facebook.com/groups/185350018231892/media
       - Detail - https://www.facebook.com/photo/?fbid=10151467272873986&set=g.185350018231892

   - [ ] 1.2 Identify how to distinguish between the web pages, whether via URL, or page content

     - Listing - starts with 'www.facebook.com/groups', includes 'media'
     - Detail - starts with 'www.facebook.com/photo', includes 'fbid=10151467272873986'

   - [ ] 1.3 Define labels for these distinct types in `./router.ts`

     - Listing
     - Detail

   - [ ] 1.4 Define default handler matchers based on these distinct types in `./router.ts`

     - TODO

   - [ ] 1.5 Define these distinct types in `./router.ts`

     - TODO

   - [ ] 1.6 Identify the fields / data of interest per each page.
     - [ ] 1.6.1 Which fields are composite / will need post-processing? (e.g. more info packed up in single text)
     - [ ] 1.6.2 Which fields are considered personally identifiable information (GDPR)?
     - [ ] 1.6.3 For URLs, are they relative or absolute?
   - [ ] 1.7 Check if there isn't additional data either in HTML or requests (usually Fetch/XHR)

2. Entry extraction

   - [ ] 2.1 Check if you need browser / JS to make the data load
   - [ ] 2.2. Check if you need to click / trigger anything to make the data load
   - [ ] 2.3 Check if you need cookie session to make the data load
   - [ ] 2.4 Check if you need to be logged in to make the data load
   - [ ] 2.5 Check if the page differs if you visit it via incognito
   - [ ] 2.6 Check if entries have distinct URL
     - Yes

3. Entry scheduling / Listing

   - [ ] 2.0 How do I find the listing page(s), is it single or more pages? (remember how paperindex was structured)

     - Accessed directly via URL
     - Single page, more results loaded via infinite scroll

   - [ ] 2.1 Check if you need browser / JS to make the listing load

     - need browser (ASSUMPTION)

   - [ ] 2.2 Check if you need to click / trigger anything to make the listing load

     - Visit the group photos page (DO NOT need to be logged in)

   - [ ] 2.3 Check if you need cookie session to make the listing load

     - Included by visiting group page (if using browser)

   - [ ] 2.4 Check if you need to be logged in to make the listing load

     - No!

   - [ ] 2.5 Check if the page differs if you visit it via incognito

     - It looks different when user is not logged in, but the content is still there

   - [ ] 2.6 How do I find the total results count?

     - Not available??

   - [ ] 2.7 Check if there's upper limit on the listing results

     - TODO

     - [ ] 2.7.1 If so, what strategies are available to get over the limit?

   - [ ] 2.8 What filters are available?

     - None

     - [ ] 2.8.1 Are the filters set via query params, post body, interaction with server, or other?

       - POST (graphql)

     - [ ] 2.8.2 Identify the available / permitted values for each of filters?

   - [ ] 2.9 Is there option to set items per page and / or current page?
     - [ ] 2.9.1 If available, to how high value can I set items per page? Does it impact load time?
   - [ ] 2.10 How do I reset the filter? Do I need to interact with the server (like in SKSCRIS?)
   - [ ] 2.11 Is there other data on the entries that's on the listing page, but not on entry page?
   - [ ] 2.12 Is the data on listing page sufficient for a "simple" version of the dataset?
   - [ ] 2.13 Are there non-entry elements in the list? (E.g. inline ads) How do I exclude them?
   - [ ] 2.14 How do I know if there are no results on the page?
     - [ ] 2.14.1 In such case, how do I know whether it's the end of the pagination?
   - [ ] 2.15 How do I identify the next page URL or action to load next page?
   - [ ] 2.16 How do if I'm on last page of pagination?

4. Communicate the findings to client, agree on scope

5. Implement step 1.
6. Implement step 2.
7. Implement step 3.
