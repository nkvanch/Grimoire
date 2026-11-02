// Restoring a campaign's live-table preparation from a backup writes the document as it was saved,
// under the same rule edit() enforces: preparation never carries live-session values.
import { InMemoryKv } from '../kv';
import { PrepService, newCampaignPrep } from '../prep';

describe('PrepService.restore', () => {
  it('writes a saved preparation back so load() and list() see it', async () => {
    const svc = new PrepService(new InMemoryKv(), () => 5);
    const doc = { ...newCampaignPrep('k1', 'Tuesday Table', 1), campaignRevision: 7 };

    await svc.restore(doc);

    expect(await svc.load('k1')).toEqual(doc);
    expect(await svc.list()).toEqual([{ campaignId: 'k1', name: 'Tuesday Table', campaignRevision: 7 }]);
  });

  it('refuses a document carrying live-session fields', async () => {
    const svc = new PrepService(new InMemoryKv());
    const doc = { ...newCampaignPrep('k1', 'T', 1), encounters: [{ id: 'e1', name: 'Ambush', liveRevision: 3 }] } as never;
    await expect(svc.restore(doc)).rejects.toThrow(/live-session fields/);
    expect(await svc.load('k1')).toBeNull();
  });
});
