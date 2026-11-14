// ============================================================================
// FILE: src/content/recordPictures.ts
// Pictures on any content record, as the desktop keeps them (its docs/CONTRACTS.md "Pictures"): `imageUri` is the icon (a square crop,
// at most 300 KB encoded) and `imageDetailUri` the detail picture (at most 600 KB), both `data:image/...;base64,` URIs inside the record,
// so packs, backups and live play carry them unchanged. A member that is not a data:image string is no picture; a detail picture
// without an icon is no picture either (the desktop drops it on its next save, and so does this).
// ============================================================================

export type RecordPictures = { imageUri?: string; imageDetailUri?: string };

export const ICON_MAX_BYTES = 300 * 1024;
export const DETAIL_MAX_BYTES = 600 * 1024;

// raster formats only (what both apps write); an SVG or anything else from an imported record is no picture
const isPicture = (v: unknown): v is string => typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(v);

/** Past this a picture from an imported record is not decoded for display (four times the detail limit; older phone photos had none). */
export const DISPLAY_MAX_BYTES = 4 * DETAIL_MAX_BYTES;

/** The pictures a record carries. */
export function picturesOf(record: unknown): RecordPictures {
  const r = (record ?? {}) as Record<string, unknown>;
  if (!isPicture(r.imageUri)) return {};
  return { imageUri: r.imageUri, ...(isPicture(r.imageDetailUri) ? { imageDetailUri: r.imageDetailUri } : {}) };
}

/** `record` with exactly these pictures: set when given, removed when not. */
export function withPictures<T extends object>(pictures: RecordPictures, record: T): T {
  const { imageUri: _i, imageDetailUri: _d, ...rest } = record as T & RecordPictures;
  const kept = picturesOf(pictures);
  return { ...rest, ...kept } as T;
}

/** A new icon: the old detail picture belonged to the old icon, so it goes (the desktop cannot tell a replaced photo from the right one). */
export const replaceIcon = (_old: RecordPictures, imageUri: string | undefined): RecordPictures => (imageUri ? { imageUri } : {});

/** The encoded size of a data URI, in bytes. */
export function pictureBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}
