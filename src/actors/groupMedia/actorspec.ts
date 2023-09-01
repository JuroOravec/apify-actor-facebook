import type { DatasetFeatures, DatasetModes } from 'actor-spec';
import type { ApifyScraperActorSpec } from 'crawlee-one';


// const filters = ['geographic region (kraj)', 'starting letter'];


const modes = [
  // { name: 'fast', isDefault: true, shortDesc: 'only data on the entries themselves' },
  // { name: 'detailed', isDefault: false, shortDesc: 'includes all relationships' },
] satisfies DatasetModes[];


const datasetFeatures = {
  limitResultsCount: true,
  usesBrowser: true,
  proxySupport: true,
  configurable: true,
  regularlyTested: true,
  privacyCompliance: true,
  errorMonitoring: true,
  changeMonitoring: false,
  integratedETL: true,
  integratedCache: true,
  downstreamAutomation: true,
} satisfies DatasetFeatures;

const actorId = 'facebook-group-media-scraper';
const authorId = 'jurooravec';

const actorSpec = {
  actorspecVersion: 1,
  actor: {
    title: 'Facebook Group Media Scraper',
    publicUrl: `https://apify.com/${authorId}/${actorId}`,
    shortDesc:
      'Extract Photos, Videos and Albums from Public Groups - likes, comments, views, shares, URLs, authors, and more.',
    
    datasetOverviewImgUrl: null, // '/public/imgs/skcris-actor-dataset-overview.png',
  },
  platform: {
    name: 'apify',
    url: 'https://apify.com',
    authorId,
    authorProfileUrl: `https://apify.com/${authorId}`,
    actorId,
    socials: {
      discord: 'https://discord.com/channels/801163717915574323',
    },
  },
  authors: [
    {
      name: 'Juro Oravec',
      email: 'juraj.oravec.josefson@gmail.com',
      authorUrl: 'https://jurora.vc',
    },
  ],
  websites: [
    {
      name: 'Facebook',
      url: 'https://www.facebook.com/',
    },
  ],
  pricing: {
    pricingType: 'per results',
    value: 5,
    currency: 'eur',
    period: 1000,
    periodUnit: 'results',
  },
  datasets: [
    
    // {
    //   name: 'organisations',
    //   shortDesc: 'All organisations in SKCRIS',
    //   url: 'https://www.skcris.sk/portal/web/guest/register-organizations',
    //   size: 2600,
    //   isDefault: true,
    //   filters,
    //   filterCompleteness: 'some',
    //   modes,
    //   features: datasetFeatures,
    //   faultTolerance: {
    //     dataLossScope: 'entry',
    //     timeLostAvgSec: 5,
    //     timeLostMaxSec: 7200, // 2 hrs
    //   },
    //   perfTable: 'default',
    //   // prettier-ignore
    //   perfStats: [
    //     { rowId: 'fast', colId: '100items', mode: 'fast', count: 100, costUsd: 0.014, timeSec: 120 },
    //     { rowId: 'fast', colId: 'fullRun', mode: 'fast', count: 'all', costUsd: 0.289, timeSec: 2520 },
    //     { rowId: 'detailed', colId: '100items', mode: 'detailed', count: 100, costUsd: 0.08, timeSec: 697 },
    //     { rowId: 'detailed', colId: 'fullRun', mode: 'detailed', count: 'all', costUsd: 2.008, timeSec: 17520 },
    //   ],
    //   privacy: {
    //     personalDataFields: ['email', 'phone', 'researchers'],
    //     isPersonalDataRedacted: true,
    //     personalDataSubjects: ['employees', 'researchers'],
    //   },
    //   output: {
    //     exampleEntry: {
    //       guid: 'cfOrg_32',
    //       url: 'https://www.skcris.sk/portal/register-organizations?p_p_id=organisationSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_organisationSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfOrg_32',
    //       name: 'Company Name, s.r.o.',
    //       acronym: null,
    //       ičo: '12345678',
    //       description: '-',
    //       govDept: 'bez príslušnosti k orgánu štátu a štátnej správy',
    //       skNace: 'poradenské služby v oblasti podnikania a riadenia',
    //       financingType: 'hospodárska organizácia',
    //       orgType: 'podnikateľský sektor vav',
    //       activityMain: 'iná prevažujúca činnosť ako výskum a vývoj',
    //       activitySpec: 'technické vedy / informačné a komunikačné technológie / riadenie procesov',
    //       email: ['email@address.sk'],
    //       phone: '+421 12 3456789',
    //       website: 'www.example.sk',
    //       certificateText: '-',
    //       certificate: null,
    //       certificateStartDate: null,
    //       certificateEndDate: null,
    //       activitySpec1: 'technické vedy',
    //       activitySpec2: 'informačné a komunikačné technológie',
    //       activitySpec3: 'riadenie procesov',
    //       addresses: [
    //         {
    //           country: 'Country [name=Slovensko, code=SK]',
    //           countryName: 'Slovensko',
    //           adrLine1: '123',
    //           adrLine2: null,
    //           adrLine3: 'StreetName',
    //           adrLine4: 'Okres Prešov',
    //           adrLine5: 'Prešovský kraj',
    //           postCode: '01234',
    //           cityTown: 'Prešov',
    //           cfUri: null,
    //           region: 'Prešovský kraj',
    //           district: 'Okres Prešov',
    //           township: 'Prešov',
    //           type: 'kontaktná adresa',
    //         },
    //       ],
    //       researchers: [
    //         {
    //           id: 18067,
    //           name: 'LastName FirstName',
    //           roles: [
    //             {
    //               role: 'kontaktná osoba',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_researcherSearchResult_WAR_cvtiappweb_action=goresdetail&id=18067',
    //         },
    //       ],
    //       projects: [
    //         {
    //           id: 5696,
    //           name: 'Zlepšovanie kvality a zvyšovanie výkonnosti MSP aplikáciou metód maximalizácie podnikateľského úspechu 2',
    //           roles: [
    //             {
    //               role: 'spoluriešiteľská organizácia',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-projects?p_p_id=projectSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_projectSearchResult_WAR_cvtiappweb_javax.portlet.action=projectgodetail&id=5696',
    //         },
    //       ],
    //       parentOrgs: [],
    //       childOrgs: [],
    //       productOutputs: [],
    //       patentOutputs: [],
    //       publicationOutputs: [],
    //       innovationOutputs: [],
    //       equipmentInfra: [],
    //       facilityInfra: [],
    //       serviceInfra: [],
    //       addressesCount: 1,
    //       researchersCount: 3,
    //       projectsCount: 1,
    //       parentOrgsCount: 0,
    //       childOrgsCount: 0,
    //       productOutputsCount: 0,
    //       patentOutputsCount: 0,
    //       publicationOutputsCount: 0,
    //       innovationOutputsCount: 0,
    //       equipmentInfraCount: 0,
    //       facilityInfraCount: 0,
    //       serviceInfraCount: 0,
    //       metadata: {
    //         actorId: '2YjGNj4zGPIntw4wh',
    //         actorRunId: 'mFTsl9nmpSle091a7',
    //         actorRunUrl:
    //           'https://console.apify.com/actors/2YjGNj4zGPIntw4wh/runs/mFTsl9nmpSle091a7',
    //         contextId: 'Q1QNClHk6C',
    //         requestId: 'IXPi6SyvIPdkyxe',
    //         originalUrl:
    //           'https://www.skcris.sk/portal/register-organizations?p_p_id=organisationSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_organisationSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfOrg_32',
    //         loadedUrl:
    //           'https://www.skcris.sk/portal/register-organizations?p_p_id=organisationSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_organisationSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfOrg_32',
    //         dateHandled: '2023-04-28T17:29:19.255Z',
    //         numberOfRetries: 0,
    //       },
    //     },
    //     exampleEntryComments: {
    //       addresses: 'Only in detailed entry',
    //       researchers: 'Only in detailed entry',
    //       projects: 'Only in detailed entry',
    //       parentOrgs: 'Only in detailed entry',
    //       childOrgs: 'Only in detailed entry',
    //       productOutputs: 'Only in detailed entry',
    //       patentOutputs: 'Only in detailed entry',
    //       publicationOutputs: 'Only in detailed entry',
    //       innovationOutputs: 'Only in detailed entry',
    //       equipmentInfra: 'Only in detailed entry',
    //       facilityInfra: 'Only in detailed entry',
    //       serviceInfra: 'Only in detailed entry',
    //       addressesCount: 'Only in detailed entry',
    //       researchersCount: 'Only in detailed entry',
    //       projectsCount: 'Only in detailed entry',
    //       parentOrgsCount: 'Only in detailed entry',
    //       childOrgsCount: 'Only in detailed entry',
    //       productOutputsCount: 'Only in detailed entry',
    //       patentOutputsCount: 'Only in detailed entry',
    //       publicationOutputsCount: 'Only in detailed entry',
    //       innovationOutputsCount: 'Only in detailed entry',
    //       equipmentInfraCount: 'Only in detailed entry',
    //       facilityInfraCount: 'Only in detailed entry',
    //       serviceInfraCount: 'Only in detailed entry',
    //     },
    //   },
    // },
    // {
    //   name: 'researchers',
    //   shortDesc: 'All researchers in SKCRIS',
    //   url: 'https://www.skcris.sk/portal/web/guest/register-researchers',
    //   size: 37500,
    //   isDefault: false,
    //   filters,
    //   filterCompleteness: 'some',
    //   modes,
    //   features: datasetFeatures,
    //   faultTolerance: {
    //     dataLossScope: 'entry',
    //     timeLostAvgSec: 5,
    //     timeLostMaxSec: 60,
    //   },
    //   perfTable: 'default',
    //   // prettier-ignore
    //   perfStats: [
    //     { rowId: 'fast', colId: '100items', mode: 'fast', count: 100, costUsd: 0.016, timeSec: 143 },
    //     { rowId: 'fast', colId: 'fullRun', mode: 'fast', count: 'all', costUsd: 3.567, timeSec: 31140 },
    //     { rowId: 'detailed', colId: '100items', mode: 'detailed', count: 100, costUsd: 0.052, timeSec: 450 },
    //     { rowId: 'detailed', colId: 'fullRun', mode: 'detailed', count: 'all', costUsd: 16.949, timeSec: 147900 },
    //   ],
    //   privacy: {
    //     personalDataFields: ['guid', 'url', 'fullName', 'email'],
    //     isPersonalDataRedacted: true,
    //     personalDataSubjects: ['researchers'],
    //   },
    //   output: {
    //     exampleEntry: {
    //       guid: 'cfPers_1123',
    //       url: 'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_researcherSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfPers_1123',
    //       fullName: 'FirstName LastName',
    //       datasource: 'výskumník - crepč',
    //       industry: 'ostatné príbuzné odbory pedagogických vied, učiteľstva a vychovávateľstva',
    //       orgType: 'sektor vysokých škôl',
    //       keywords: [],
    //       annotation: '-',
    //       website: null,
    //       email: ['email@example.sk'],
    //       organisations: [
    //         {
    //           id: 1264,
    //           name: 'Univerzita Komenského v Bratislave, Pedagogická fakulta',
    //           roles: [
    //             {
    //               role: 'výskumník',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-organizations?p_p_id=organisationSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_organisationSearchResult_WAR_cvtiappweb_javax.portlet.action=organizationgodetail&id=1264',
    //         },
    //       ],
    //       projects: [],
    //       productOutputs: [],
    //       patentOutputs: [],
    //       publicationOutputs: [
    //         {
    //           id: 459296,
    //           name: 'Ako viesť deti k prekonávaniu psychických problémov...',
    //           roles: [
    //             {
    //               role: 'autor',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_researcherSearchResult_WAR_cvtiappweb_action=linkedvysledky&type=publication&id=459296',
    //         },
    //       ],
    //       innovationOutputs: [],
    //       citationOutputs: [],
    //       organisationsCount: 1,
    //       projectsCount: 0,
    //       productOutputsCount: 0,
    //       patentOutputsCount: 0,
    //       publicationOutputsCount: 6,
    //       innovationOutputsCount: 0,
    //       citationOutputsCount: 0,
    //       metadata: {
    //         actorId: '2YjGNj4zGPIntw4wh',
    //         actorRunId: '9QSIhfpo23yTt9USW',
    //         actorRunUrl:
    //           'https://console.apify.com/actors/2YjGNj4zGPIntw4wh/runs/9QSIhfpo23yTt9USW',
    //         contextId: 'cP7NpdPf8L',
    //         requestId: 'wzi5GGf8ODheLh7',
    //         originalUrl:
    //           'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_researcherSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfPers_1123',
    //         loadedUrl:
    //           'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_researcherSearchResult_WAR_cvtiappweb_javax.portlet.action=godetail&guid=cfPers_1123',
    //         dateHandled: '2023-04-28T19:22:49.801Z',
    //         numberOfRetries: 0,
    //       },
    //     },
    //     exampleEntryComments: {
    //       organisations: 'Only in detailed entry',
    //       projects: 'Only in detailed entry',
    //       productOutputs: 'Only in detailed entry',
    //       patentOutputs: 'Only in detailed entry',
    //       publicationOutputs: 'Only in detailed entry',
    //       innovationOutputs: 'Only in detailed entry',
    //       citationOutputs: 'Only in detailed entry',
    //       organisationsCount: 'Only in detailed entry',
    //       projectsCount: 'Only in detailed entry',
    //       productOutputsCount: 'Only in detailed entry',
    //       patentOutputsCount: 'Only in detailed entry',
    //       publicationOutputsCount: 'Only in detailed entry',
    //       innovationOutputsCount: 'Only in detailed entry',
    //       citationOutputsCount: 'Only in detailed entry',
    //     },
    //   },
    // },
    // {
    //   name: 'projects',
    //   shortDesc: 'All projects in SKCRIS',
    //   url: 'https://www.skcris.sk/portal/web/guest/register-projects',
    //   size: 24900,
    //   isDefault: false,
    //   filters,
    //   filterCompleteness: 'some',
    //   modes,
    //   features: datasetFeatures,
    //   faultTolerance: {
    //     dataLossScope: 'entry',
    //     timeLostAvgSec: 5,
    //     timeLostMaxSec: 60,
    //   },
    //   perfTable: 'default',
    //   // prettier-ignore
    //   perfStats: [
    //     { rowId: 'fast', colId: '100items', mode: 'fast', count: 100, costUsd: 0.017, timeSec: 150 },
    //     { rowId: 'fast', colId: 'fullRun', mode: 'fast', count: 'all', costUsd: 4.288, timeSec: 22440 },
    //     { rowId: 'detailed', colId: '100items', mode: 'detailed', count: 100, costUsd: 0.066, timeSec: 580 },
    //     { rowId: 'detailed', colId: 'fullRun', mode: 'detailed', count: 'all', costUsd: 16.548, timeSec: 14820 },
    //   ],
    //   privacy: {
    //     personalDataFields: ['researchers'],
    //     isPersonalDataRedacted: true,
    //     personalDataSubjects: ['researchers'],
    //   },
    //   output: {
    //     exampleEntry: {
    //       guid: 'cfProj_15010',
    //       url: 'https://www.skcris.sk/portal/register-projects?p_p_id=projectSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_projectSearchResult_WAR_cvtiappweb_javax.portlet.action=projectgodetail&guid=cfProj_15010',
    //       name: 'Adaptívne osobné finančné plánovanie šité na mieru a správa aktív a pasív',
    //       projectCode: '8179',
    //       duration: '01.09.2013 - 31.08.2015',
    //       abstract:
    //         'Cieľom projektu TAP-PALM je dodávať podporný softvér finančným plánovačom zákazníkov, ktorý poskytuje bezprecedentné prispôsobenie potrebám a cieľom klientov počas životnosti finančného plánu. Nový prístup využíva hybridné matematické modely (analytická simulácia a simulácia založená na agentoch) a BPM orientované na cieľ.',
    //       keywords: [],
    //       grantCallName:
    //         '04.03 2013 EUREKA SK Výzva MŠVVaŠ SR na predkladanie návrhov projektov na získanie účelovej podpory na spolufinancovanie projektov programu EUREKA SK',
    //       awardAmountEur: 150000.0,
    //       activitySpec:
    //         'prírodné vedy / počítačové a informatické vedy (okrem 020300 informačné a komunikačné technológie a 050804 knižničná a informačná veda) / ostatné príbuzné odbory informatických vied',
    //       researchType: 'aplikovaný (priemyselný) výskum',
    //       programmeType: 'medzinárodná spolupráca - eureka',
    //       durationStart: '01.09.2013',
    //       durationEnd: '31.08.2015',
    //       activitySpec1: 'prírodné vedy',
    //       activitySpec2:
    //         'počítačové a informatické vedy (okrem 020300 informačné a komunikačné technológie a 050804 knižničná a informačná veda)',
    //       activitySpec3: 'ostatné príbuzné odbory informatických vied',
    //       researchers: [
    //         {
    //           id: 24665,
    //           name: 'LastName FirstName',
    //           roles: [
    //             {
    //               role: 'riešiteľ',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-researchers?p_p_id=researcherSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_researcherSearchResult_WAR_cvtiappweb_action=goresdetail&id=24665',
    //         },
    //       ],
    //       organisations: [
    //         {
    //           id: 4026,
    //           name: 'Company Name, s.r.o.',
    //           roles: [
    //             {
    //               role: 'žiadateľ',
    //             },
    //           ],
    //           url: 'https://www.skcris.sk/portal/register-organizations?p_p_id=organisationSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&p_p_mode=view&p_p_col_id=column-3&p_p_col_pos=2&p_p_col_count=3&_organisationSearchResult_WAR_cvtiappweb_javax.portlet.action=organizationgodetail&id=4026',
    //         },
    //       ],
    //       productOutputs: [],
    //       patentOutputs: [],
    //       publicationOutputs: [],
    //       innovationOutputs: [],
    //       equipmentInfra: [],
    //       facilityInfra: [],
    //       serviceInfra: [],
    //       documents: [],
    //       researchersCount: 1,
    //       organisationsCount: 1,
    //       productOutputsCount: 0,
    //       patentOutputsCount: 0,
    //       publicationOutputsCount: 0,
    //       innovationOutputsCount: 0,
    //       equipmentInfraCount: 0,
    //       facilityInfraCount: 0,
    //       serviceInfraCount: 0,
    //       documentsCount: 0,
    //       metadata: {
    //         actorId: '2YjGNj4zGPIntw4wh',
    //         actorRunId: '2OwhtQlclOj853cj2',
    //         actorRunUrl:
    //           'https://console.apify.com/actors/2YjGNj4zGPIntw4wh/runs/2OwhtQlclOj853cj2',
    //         contextId: 'bPSoxOMbEc',
    //         requestId: 'PCFg1VineLv8yq5',
    //         originalUrl:
    //           'https://www.skcris.sk/portal/register-projects?p_p_id=projectSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_projectSearchResult_WAR_cvtiappweb_javax.portlet.action=projectgodetail&guid=cfProj_15010',
    //         loadedUrl:
    //           'https://www.skcris.sk/portal/register-projects?p_p_id=projectSearchResult_WAR_cvtiappweb&p_p_lifecycle=1&p_p_state=normal&_projectSearchResult_WAR_cvtiappweb_javax.portlet.action=projectgodetail&guid=cfProj_15010',
    //         dateHandled: '2023-04-28T18:49:15.444Z',
    //         numberOfRetries: 0,
    //       },
    //     },
    //     exampleEntryComments: {
    //       researchers: 'Only in detailed entry',
    //       organisations: 'Only in detailed entry',
    //       productOutputs: 'Only in detailed entry',
    //       patentOutputs: 'Only in detailed entry',
    //       publicationOutputs: 'Only in detailed entry',
    //       innovationOutputs: 'Only in detailed entry',
    //       equipmentInfra: 'Only in detailed entry',
    //       facilityInfra: 'Only in detailed entry',
    //       serviceInfra: 'Only in detailed entry',
    //       documents: 'Only in detailed entry',
    //       researchersCount: 'Only in detailed entry',
    //       organisationsCount: 'Only in detailed entry',
    //       productOutputsCount: 'Only in detailed entry',
    //       patentOutputsCount: 'Only in detailed entry',
    //       publicationOutputsCount: 'Only in detailed entry',
    //       innovationOutputsCount: 'Only in detailed entry',
    //       equipmentInfraCount: 'Only in detailed entry',
    //       facilityInfraCount: 'Only in detailed entry',
    //       serviceInfraCount: 'Only in detailed entry',
    //       documentsCount: 'Only in detailed entry',
    //     },
    //   },
    // },
  ],
} satisfies ApifyScraperActorSpec;

export default actorSpec;
