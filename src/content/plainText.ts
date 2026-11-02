// ============================================================================
// FILE: src/content/plainText.ts
// Spell text is shown as plain text, but some of the bundled SRD 5.1 records
// still carry Markdown from where their text was collected: links to a
// third-party site (`_[knock](https://www.aidedd.org/...)_`) and emphasis
// markers (`**_At Higher Levels_**`). The signed pack file can only change when
// it is rebuilt and re-signed (scripts/build-srd-packs.ts), so the provider
// cleans the text as it hands spells to the app: a player never sees link
// syntax or a link to another site, only the words.
// ============================================================================

/** `[label](url)` and `_[label](url)_` become `label`. */
export function unwrapMarkdownLinks(text: string): string {
  return text
    .replace(/_\[([^\]\n]+)\]\((?:https?:)?\/\/[^)\s]+\)_/g, '$1')
    .replace(/\[([^\]\n]+)\]\((?:https?:)?\/\/[^)\s]+\)/g, '$1');
}

/** Strips Markdown emphasis (`**bold**`, `_italic_`, `**_both_**`) so plain-text screens show the words alone. */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[\s(“"'])_([^_\n]+)_(?=$|[\s.,;:!?)”"'])/gm, '$1$2');
}

/** Link syntax removed, then emphasis. Null and undefined pass through. */
export function plainText<T extends string | null | undefined>(text: T): T {
  if (typeof text !== 'string') return text;
  return stripMarkdownEmphasis(unwrapMarkdownLinks(text)) as T;
}
