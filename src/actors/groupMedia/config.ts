import {
  createActorConfig,
  createActorInputSchema,
  Field,
  ActorInputSchema,
  createActorOutputSchema,
} from 'apify-actor-config';
import {
  CrawlerConfigActorInput,
  LoggingActorInput,
  OutputActorInput,
  PrivacyActorInput,
  ProxyActorInput,
  StartUrlsActorInput,
  MetamorphActorInput,
  crawlerInput,
  loggingInput,
  outputInput,
  privacyInput,
  proxyInput,
  startUrlsInput,
  metamorphInput,
  PerfActorInput,
  perfInput,
} from 'apify-actor-utils';

import actorSpec from './actorspec';

// const createTagFn = (tag: string) => (t: string) => `<${tag}>${t}</${tag}>`;
// const strong = createTagFn('strong');
// const newLine = (repeats = 1) => '<br/>'.repeat(repeats);

export type FbGroupMediaCustomActorInput = {
  /** No custom fields currently */
};

/** Shape of the data passed to the actor from Apify */
export interface FbGroupMediaActorInput
  // Include the common fields in input
  extends CrawlerConfigActorInput,
    StartUrlsActorInput,
    LoggingActorInput,
    ProxyActorInput,
    PrivacyActorInput,
    OutputActorInput,
    MetamorphActorInput,
    PerfActorInput,
    FbGroupMediaCustomActorInput {}

const customActorInput = {
  /** No custom fields currently */
  // listingCountOnly: createBooleanField({
  //   title: 'Count the total matched results',
  //   type: 'boolean',
  //   description: `If checked, no data is extracted. Instead, the count of matched results is printed in the log.`,
  //   default: false,
  //   groupCaption: 'Troubleshooting options',
  //   groupDescription: 'Use these to verify that your custom startUrls are correct',
  //   nullable: true,
  // }),
} satisfies Record<keyof FbGroupMediaCustomActorInput, Field>;

// Customize the default options
crawlerInput.requestHandlerTimeoutSecs.prefill = 60 * 60 * 1; // 1 HR
crawlerInput.maxRequestRetries.default = 5;
crawlerInput.maxRequestRetries.prefill = 5;
crawlerInput.maxConcurrency.default = 5;
crawlerInput.maxConcurrency.prefill = 5;

const inputSchema = createActorInputSchema<
  ActorInputSchema<Record<keyof FbGroupMediaActorInput, Field>>
>({
  schemaVersion: 1,
  title: actorSpec.actor.title,
  description: `Configure the ${actorSpec.actor.title}.`,
  type: 'object',
  properties: {
    ...customActorInput,
    // Include the common fields in input
    ...startUrlsInput,
    ...proxyInput,
    ...privacyInput,
    ...outputInput,
    ...crawlerInput,
    ...perfInput,
    ...loggingInput,
    ...metamorphInput,
  },
});

const outputSchema = createActorOutputSchema({
  actorSpecification: 1,
  fields: {},
  views: {},
});

const config = createActorConfig({
  actorSpecification: 1,
  name: actorSpec.platform.actorId,
  title: actorSpec.actor.title,
  description: actorSpec.actor.shortDesc,
  version: '1.0',
  dockerfile: '../Dockerfile',
  dockerContextDir: '../../..',
  input: inputSchema,
  storages: {
    dataset: outputSchema,
  },
});

export default config;
