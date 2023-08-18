import Jimp from 'jimp';

// TODO - Move to utils?

export interface ImageMeta {
  url: string | null;
  height: number | null;
  width: number | null;
  size: number | null;
  mime: string | null;
}

export const imageMeta = <T extends ImageMeta>(overrides?: Partial<T>) =>
  ({
    url: null,
    height: null,
    width: null,
    size: null,
    mime: null,
    ...overrides,
  } satisfies ImageMeta);

// See
// https://stackoverflow.com/questions/12539918
// https://stackoverflow.com/a/11442850/9788634
export const getImageMetaFromUrl = async (url: string) => {
  // // "new Image()" works only in browser
  // new Promise((resolve, reject) => {
  //   const img = new Image();
  //   img.onload = () => resolve(img);
  //   img.onerror = (err) => reject(err);
  //   img.src = url;
  // });

  // See https://github.com/jimp-dev/jimp
  const jimage = await Jimp.read(url).catch((err) => {
    console.error(err);
    return null;
  });

  const imgMeta = {
    url,
    height: jimage?.getHeight() ?? null,
    width: jimage?.getWidth() ?? null,
    size: jimage?.bitmap.data.byteLength ?? null,
    mime: jimage?.getMIME() ?? null,
  } satisfies ImageMeta;

  return imgMeta;
};

export const makeImageMeta = async <T extends object>(url?: string | null, extraProps?: T) => {
  const imageMetadata = url ? await getImageMetaFromUrl(url) : imageMeta();
  return { ...(extraProps as T), ...imageMetadata };
};
