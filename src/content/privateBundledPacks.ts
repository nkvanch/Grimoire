// The public and web builds, and any build without the private pack files: no private pack (see src/content/privateBundledPacks.ts).
export const PRIVATE_BUNDLED_PACKS: readonly never[] = [];   // no imports: the export copies this file one folder up
export type BundledHomebrew = { name: string; fileName: string; load: () => unknown };
export const PRIVATE_BUNDLED_HOMEBREW: readonly BundledHomebrew[] = [];
