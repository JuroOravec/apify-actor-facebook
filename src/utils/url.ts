/** Validate correctness of a URL */
export const validateUrl = (url: string) => {
  try {
    new URL(url);
  } catch (err) {
    (err as Error).message += `\nURL: "${url}"`;
    throw err;
  }
};

/** Transform relative URL paths to absolute URLs */
export const resolveUrlPath = (urlBase: string, urlPath: string) => {
  const url = new URL(urlBase);
  url.pathname = urlPath;
  return url.href;
};

/** Sort URL's query params */
export const sortUrl = (url: string) => {
  const urlObj = new URL(url);

  urlObj.searchParams.sort();
  return urlObj.href;
};

export const equalUrls = (url1: string, url2: string) => {
  const url1Sorted = sortUrl(url1);
  const url2Sorted = sortUrl(url2);

  return url1Sorted === url2Sorted;
};

export const removeSearchParams = (url: string, params: string[]) => {
  const urlObj = new URL(url);
  params.forEach((param) => urlObj.searchParams.delete(param));
  return urlObj.toString();
};

export const getSearchParams = <TParams extends string, TAllParams extends boolean = false>(
  url: string,
  params: TParams[],
  options?: {
    /** By default only the first value is returned. Set this to `true` to get a list of all values for that search param. */
    all?: TAllParams;
  }
) => {
  const urlObj = new URL(url);
  const paramValues = params.reduce<
    Record<TParams, TAllParams extends true ? string[] : string | null>
  >((agg, param) => {
    const paramValue = options?.all
      ? urlObj.searchParams.getAll(param)
      : urlObj.searchParams.get(param);
    agg[param] = paramValue as any;
    return agg;
  }, {} as any);
  return paramValues;
};
