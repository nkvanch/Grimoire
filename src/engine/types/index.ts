// ============================================================================
// D&D 5e Rules & State Mutation Engine Contract: the engine's types, one file per subject.
// Import from 'engine/types' as before; this file re-exports every part.
//
//   primitives.ts       1. Primitive aliases and shared enums
//   race.ts             2. Static content: races
//   charClass.ts        Static content: mode groups and classes
//   content.ts          Static content: backgrounds, items, feats, ContentDB
//   diagnostics.ts      Diagnostics
//   entityRuntime.ts    3. Entity runtime schemas (Identity, Stats, Resources, ...)
//   choices.ts          Choices and prerequisites
//   spellInventory.ts   Spellcasting, spells, beast forms, inventory
//   conditions.ts       4. Condition system
//   feature.ts          5. Feature and passive Effect system (fires in recomputeDerived)
//   draftTrait.ts       5b. Homebrew draft-trait model
//   entity.ts           6. Entity master type
//   leveling.ts         7. Leveling schemas
//   dmOverride.ts       8. DM Override system (separate record, applied last in the pipeline)
//   audit.ts            9. Audit trail system (every derived value is explainable)
//   actionCard.ts       10. Action card system (active effects, card generator types)
//   campaign.ts         11. Campaign system (offline state on one device)
//   preparedEncounter.tsPrepared encounters
//   dice.ts             12. Dice roller
// ============================================================================
export * from './primitives';
export * from './race';
export * from './charClass';
export * from './content';
export * from './diagnostics';
export * from './entityRuntime';
export * from './choices';
export * from './spellInventory';
export * from './conditions';
export * from './feature';
export * from './draftTrait';
export * from './entity';
export * from './leveling';
export * from './dmOverride';
export * from './audit';
export * from './actionCard';
export * from './campaign';
export * from './preparedEncounter';
export * from './dice';
