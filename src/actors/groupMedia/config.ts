import {
  createActorConfig,
  createActorInputSchema,
  Field,
  ActorInputSchema,
  createActorOutputSchema,
} from 'apify-actor-config';
import { AllActorInputs, allActorInputs as _allActorInputs } from 'crawlee-one';

import actorSpec from './actorspec';

// const createTagFn = (tag: string) => (t: string) => `<${tag}>${t}</${tag}>`;
// const strong = createTagFn('strong');
// const newLine = (repeats = 1) => '<br/>'.repeat(repeats);

export type FbGroupMediaCustomActorInput = {
  /** No custom fields currently */
};

/** Shape of the data passed to the actor from Apify */
export type FbGroupMediaActorInput = FbGroupMediaCustomActorInput &
  Omit<AllActorInputs, 'ignoreSslErrors'>;

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

// 'ignoreSslErrors' is not applicable to Playwright
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const { ignoreSslErrors, ...allActorInputs } = _allActorInputs;

allActorInputs.requestHandlerTimeoutSecs.prefill = 60 * 60 * 24; // 24 HR
allActorInputs.maxRequestRetries.default = 5;
allActorInputs.maxRequestRetries.prefill = 5;
allActorInputs.maxConcurrency.default = 5;
allActorInputs.maxConcurrency.prefill = 5;

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
    ...allActorInputs,
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
