export type MaybePromise<T> = T | Promise<T>;
export type MaybeArray<T> = T | T[];
// prettier-ignore
export type MaybeArrayItems<T extends any[]> = T extends [infer U1] ? [U1 | null]
  : T extends [infer U1, infer U2] ? [U1 | null, U2 | null]
  : T extends [infer U1, infer U2, infer U3] ? [U1 | null, U2 | null, U3 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4] ? [U1 | null, U2 | null, U3 | null, U4 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5, infer U6] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null, U6 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5, infer U6, infer U7] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null, U6 | null, U7 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5, infer U6, infer U7, infer U8] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null, U6 | null, U7 | null, U8 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5, infer U6, infer U7, infer U8, infer U9] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null, U6 | null, U7 | null, U8 | null, U9 | null]
  : T extends [infer U1, infer U2, infer U3, infer U4, infer U5, infer U6, infer U7, infer U8, infer U9, infer U10] ? [U1 | null, U2 | null, U3 | null, U4 | null, U5 | null, U6 | null, U7 | null, U8 | null, U9 | null, U10 | null]
  : (T[number] | null)[];

export type ArrVal<T extends any[] | readonly any[]> = T[number];
