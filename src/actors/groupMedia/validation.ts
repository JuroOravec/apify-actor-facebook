import Joi from 'joi';
import { allActorInputValidationFields } from 'crawlee-one';

import type { FbGroupMediaActorInput } from './config';

const inputValidationSchema = Joi.object<FbGroupMediaActorInput>({
  ...allActorInputValidationFields,
} satisfies Record<keyof FbGroupMediaActorInput, Joi.Schema>);

export const validateInput = (input: FbGroupMediaActorInput | null) => {
  Joi.assert(input, inputValidationSchema);
};
