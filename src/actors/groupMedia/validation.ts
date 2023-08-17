import Joi from 'joi';
import {
  crawlerInputValidationFields,
  loggingInputValidationFields,
  metamorphInputValidationFields,
  outputInputValidationFields,
  privacyInputValidationFields,
  proxyInputValidationFields,
  startUrlsInputValidationFields,
  perfInputValidationFields,
} from 'apify-actor-utils';

import type { FbGroupMediaActorInput } from './config';

const inputValidationSchema = Joi.object<FbGroupMediaActorInput>({
  ...crawlerInputValidationFields,
  ...startUrlsInputValidationFields,
  ...proxyInputValidationFields,
  ...loggingInputValidationFields,
  ...privacyInputValidationFields,
  ...outputInputValidationFields,
  ...metamorphInputValidationFields,
  ...perfInputValidationFields,
} satisfies Record<keyof FbGroupMediaActorInput, Joi.Schema>);

export const validateInput = (input: FbGroupMediaActorInput | null) => {
  Joi.assert(input, inputValidationSchema);
};
