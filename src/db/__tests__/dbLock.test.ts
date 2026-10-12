// src/db/__tests__/dbLock.test.ts
// On the web the database file is held by one page at a time. A reload or a second tab used to leave the new page with no storage at
// all (every repo then threw "Database not initialized"); opening now retries while the lock is held.
import { Platform } from 'react-native';

const lockError = () => {
  const e = new Error("Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.");
  e.name = 'NoModificationAllowedError';
  return e;
};

describe('database open on the web', () => {
  const originalOS = Platform.OS;
  let openSpy: jest.Mock;
  const fakeDb = { withTransactionAsync: async (fn: () => Promise<void>) => fn(), execAsync: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    (Platform as any).OS = 'web';
    openSpy = jest.fn();
    jest.doMock('expo-sqlite', () => ({ openDatabaseAsync: openSpy }));
  });
  afterEach(() => {
    jest.useRealTimers();
    (Platform as any).OS = originalOS;
  });

  it('recognises the lock error and nothing else', () => {
    const { isStorageLockError } = require('../db');
    expect(isStorageLockError(lockError())).toBe(true);
    expect(isStorageLockError(new Error('disk full'))).toBe(false);
  });

  it('keeps trying while the file is locked, then opens', async () => {
    openSpy.mockRejectedValueOnce(lockError()).mockRejectedValueOnce(lockError()).mockResolvedValue(fakeDb);
    const { initDb } = require('../db');
    const pending = initDb();
    await jest.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toBe(fakeDb);
    expect(openSpy).toHaveBeenCalledTimes(3);
  });

  it('does not retry an error that is not the lock', async () => {
    openSpy.mockRejectedValue(new Error('disk full'));
    const { initDb } = require('../db');
    await expect(initDb()).rejects.toThrow('disk full');
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('gives up with the lock error when the file stays locked', async () => {
    openSpy.mockRejectedValue(lockError());
    const { initDb, isStorageLockError } = require('../db');
    const pending = initDb().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(20000);
    expect(isStorageLockError(await pending)).toBe(true);
    expect(openSpy.mock.calls.length).toBeGreaterThan(5);
  });
});
