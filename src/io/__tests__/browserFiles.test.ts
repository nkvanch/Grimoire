// The web build's file download and picker (src/io/browserFiles.ts), against a minimal fake document.
import { downloadTextFile, pickTextFileInBrowser } from '../browserFiles';

type Listener = () => void;
function fakeElement() {
  const listeners: Record<string, Listener[]> = {};
  const el: any = {
    style: {}, attrs: {} as Record<string, string>, files: undefined as undefined | { name: string; text: () => Promise<string> }[],
    clicked: 0, removed: false,
    setAttribute(k: string, v: string) { this.attrs[k] = v; },
    addEventListener(type: string, fn: Listener) { (listeners[type] ??= []).push(fn); },
    fire(type: string) { (listeners[type] ?? []).forEach(fn => fn()); },
    click() { this.clicked++; },
    remove() { this.removed = true; },
  };
  return el;
}

describe('browser files', () => {
  const created: any[] = [];
  const appended: any[] = [];
  let revoked: string[] = [];
  let blobs: Blob[] = [];

  beforeEach(() => {
    created.length = 0; appended.length = 0; revoked = []; blobs = [];
    (global as any).document = {
      createElement: () => { const e = fakeElement(); created.push(e); return e; },
      body: { appendChild: (e: unknown) => appended.push(e) },
    };
    (global as any).URL.createObjectURL = (b: Blob) => { blobs.push(b); return 'blob:fake'; };
    (global as any).URL.revokeObjectURL = (u: string) => revoked.push(u);
    jest.useFakeTimers();
  });
  afterEach(() => { jest.useRealTimers(); delete (global as any).document; });

  it('downloads text under the given file name', async () => {
    downloadTextFile('{"a":1}', 'my-pack.grimoire-pack', 'application/json');
    const a = created[0];
    expect(a.download).toBe('my-pack.grimoire-pack');
    expect(a.href).toBe('blob:fake');
    expect(a.clicked).toBe(1);
    expect(await blobs[0].text()).toBe('{"a":1}');
    jest.advanceTimersByTime(1500);
    expect(a.removed).toBe(true);
    expect(revoked).toEqual(['blob:fake']);
  });

  it('reads the chosen file as text', async () => {
    jest.useRealTimers();
    const promise = pickTextFileInBrowser('.grimoire-pack,.json');
    const input = created[0];
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.grimoire-pack,.json');
    expect(input.clicked).toBe(1);
    input.files = [{ name: 'x.grimoire-pack', text: async () => 'hello' }];
    input.fire('change');
    await expect(promise).resolves.toEqual({ name: 'x.grimoire-pack', text: 'hello' });
    expect(input.removed).toBe(true);
  });

  it('resolves null when the picker is cancelled or nothing is chosen', async () => {
    const p1 = pickTextFileInBrowser();
    created[0].fire('cancel');
    await expect(p1).resolves.toBeNull();
    const p2 = pickTextFileInBrowser();
    created[1].files = [];
    created[1].fire('change');
    await expect(p2).resolves.toBeNull();
  });
});
