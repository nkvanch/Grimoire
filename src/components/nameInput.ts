// src/components/nameInput.ts
// Spread into every TextInput that holds a name: a character, item, spell, campaign, mode... Names are invented words, and the
// keyboard's autocorrect rewrites them as you type ("Orclindbad" into ordinary words). src/__tests__/nameInputs.test.ts checks
// every name box uses it.
export const NAME_INPUT = { autoCorrect: false, spellCheck: false } as const;
