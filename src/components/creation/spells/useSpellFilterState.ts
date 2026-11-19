import { useState } from 'react';
import { useBrowseStateStore } from '../../../store/browseStateStore';
import { useEditionFilter } from '../../EditionFilter';
import { SCREEN_KEY } from './spellsScreenModel';

export function useSpellFilterState() {
  const saved = useBrowseStateStore.getState().getBrowseState(SCREEN_KEY);
  const setBrowseState = useBrowseStateStore(s => s.setBrowseState);
  const savedFilters = saved.filters ?? {};
  const [search,         setSearch]         = useState(saved.search ?? '');
  const [schoolFilter,   setSchoolFilter]   = useState<string | null>((savedFilters.schoolFilter as string) ?? null);
  // CREATION-FILTERS-1: ritual/concentration are real boolean fields on
  // Spell — 'all' is a no-op filter, so 'ritual'/'concentration' each just
  // narrow to spells where that flag is true.
  const [castFilter,     setCastFilter]     = useState<'all' | 'ritual' | 'concentration'>((savedFilters.castFilter as 'all' | 'ritual' | 'concentration') ?? 'all');
  // CREATION-FILTERS-4 (item 8): casting-time/action-type bucket — reuses
  // the same actionType() classification AddSpellModal.tsx's spell browser
  // already uses (now shared via spellFilterUtils.ts), instead of building
  // a second, different one.
  const [actionFilter,   setActionFilter]   = useState<string | null>((savedFilters.actionFilter as string) ?? null);
  // Official/Homebrew — real, derived from homebrewSpellIds membership.
  const [officialFilter, setOfficialFilter] = useState<'all' | 'official' | 'homebrew'>((savedFilters.officialFilter as 'all' | 'official' | 'homebrew') ?? 'all');
  // TIER1-EXT-1: Ruleset/Components(V/S/M) — now real, Tier-1 fields
  // (spellRepo's index was extended to carry them; see spellRepo.types.ts).
  // Source/Pack via getContentProvenance() is NOT wired on this specific
  // screen — Spell has no per-item sourcebook field at all (confirmed;
  // only Feat does), so the derived sourceLabel would only ever resolve to
  // "SRD 5.1" or undefined here, a narrower signal than the existing
  // NonSrdBadge already shows per row; not worth a whole filter axis for.
  const edition = useEditionFilter(savedFilters);   // Game / Version, starting on the character's own rules
  const [componentFilter, setComponentFilter] = useState<Set<string>>(new Set((savedFilters.componentFilter as string[]) ?? []));
  const [spellSort,      setSpellSort]      = useState(saved.sort ?? 'name_asc');
  const [filtersOpen,    setFiltersOpen]    = useState(false);
  const [cantripsOpen,   setCantripsOpen]   = useState(true);
  const [spellsOpen,     setSpellsOpen]     = useState(true);
  return {
    setBrowseState, savedFilters, search, setSearch, schoolFilter, setSchoolFilter, castFilter, setCastFilter, actionFilter,
    setActionFilter, officialFilter, setOfficialFilter, edition, componentFilter, setComponentFilter, spellSort, setSpellSort, filtersOpen,
    setFiltersOpen, cantripsOpen, setCantripsOpen, spellsOpen, setSpellsOpen,
  };
}
