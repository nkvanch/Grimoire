// Magic items the SRD 5.1 text says require attunement carry the mark (found 2026-11-14: Belt of Hill Giant Strength showed none).
import fs from 'fs';
import path from 'path';
import { FULL_ITEM_LIBRARY } from '../index';
import { itemRequiresAttunement } from '../../../engine/itemMechanics';
import ids from '../srd51AttunementIds.json';

const item = (id: string) => FULL_ITEM_LIBRARY.find(i => i.id === id)!;

it('items the SRD 5.1 text gives no attunement are left alone', () => {
  for (const id of ['broom_of_flying', 'cloak_of_the_manta_ray', 'periapt_of_health']) {
    expect([id, itemRequiresAttunement(item(id))]).toEqual([id, false]);
  }
});
