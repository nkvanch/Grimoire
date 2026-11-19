export type TabId = 'character' | 'actions' | 'spells' | 'abilities' | 'features' | 'inventory' | 'notes';

export const BASE_TABS: { id: TabId; label: string }[] = [
  { id: 'character',  label: 'Combat'     },
  { id: 'actions',    label: 'Actions'    },
  { id: 'abilities',  label: 'Abilities'  },
  { id: 'features',   label: 'Features'   },
  { id: 'inventory',  label: 'Items'      },
  { id: 'notes',      label: 'Notes'      },
];

export const SPELLS_TAB: { id: TabId; label: string } = { id: 'spells', label: 'Spells' };

export function formatShortRest(minutes: number): string {
  if (minutes >= 60) return minutes === 60 ? '1 hour' : `${minutes / 60} hours`;
  return `${minutes} min`;
}
