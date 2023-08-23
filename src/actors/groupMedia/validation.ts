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
  inputInputValidationFields,
  requestInputValidationFields,
} from 'apify-actor-utils';

import type { FbGroupMediaActorInput } from './config';

const inputValidationSchema = Joi.object<FbGroupMediaActorInput>({
  ...inputInputValidationFields,
  ...crawlerInputValidationFields,
  ...startUrlsInputValidationFields,
  ...proxyInputValidationFields,
  ...loggingInputValidationFields,
  ...privacyInputValidationFields,
  ...requestInputValidationFields,
  ...outputInputValidationFields,
  ...metamorphInputValidationFields,
  ...perfInputValidationFields,
} satisfies Record<keyof FbGroupMediaActorInput, Joi.Schema>);

export const validateInput = (input: FbGroupMediaActorInput | null) => {
  Joi.assert(input, inputValidationSchema);
};
