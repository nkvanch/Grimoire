// ============================================================================
// FILE: src/io/preparedEncounterFile.ts
// A prepared fight exported by the desktop app (its core/live/PreparedFight.cpp exportPreparedEncounter):
//   { "format": "grimoire-prepared-encounter", "version": 1, "exportedAt": <ms>, "encounter": <PreparedEncounter> }
// The inner object is this app's own PreparedEncounter. Read here and checked before it is kept: an import never overwrites a fight
// already on the device (every import gets a new id of its own), and a campaign this device does not have is dropped (the fight becomes a template).
// ============================================================================
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { EncounterStatus, PreparedEncounter } from '../engine/types';
import { MAX_PACKAGE_FILE_BYTES } from './packageIO';
import { pickTextFileInBrowser } from './browserFiles';

export const PREPARED_ENCOUNTER_FORMAT = 'grimoire-prepared-encounter';
const STATUSES: EncounterStatus[] = ['draft', 'ready', 'completed', 'archived'];
const LISTS = ['tags', 'combatants', 'groups', 'waves', 'environment', 'rewards'] as const;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The prepared fight in `text`, ready to keep; throws with a plain reason when the file is not one this app can take. */
export function parsePreparedEncounterFile(text: string, campaignIds: ReadonlySet<string>, now = Date.now()): PreparedEncounter {
  if (text.length > MAX_PACKAGE_FILE_BYTES) throw new Error('That file is too large to be a prepared fight.');
  let file: unknown;
  try { file = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
  if (!isObject(file) || file.format !== PREPARED_ENCOUNTER_FORMAT) throw new Error('That file is not a prepared fight.');
  if (file.version !== 1) throw new Error(`This prepared fight is version ${String(file.version)}; this app reads version 1. Update the app.`);
  const e = file.encounter;
  if (!isObject(e) || typeof e.name !== 'string' || !e.name.trim()) throw new Error('The prepared fight in that file has no name.');
  for (const key of LISTS) {
    if (e[key] !== undefined && !Array.isArray(e[key])) throw new Error(`The prepared fight's ${key} is not a list.`);
  }
  const combatants = (e.combatants ?? []) as unknown[];
  if (!combatants.every(c => isObject(c) && typeof c.monsterId === 'string' && typeof c.id === 'string')) {
    throw new Error('A creature in that prepared fight has no monster.');
  }
  // a new id every time: the save is an upsert, so reusing the file's id could replace a fight already here
  const id = `enc_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const { campaignId, sessionId: _session, ...rest } = e;   // a session on the other device means nothing here
  return {
    ...rest,
    id,
    name: e.name.trim(),
    ...(typeof campaignId === 'string' && campaignIds.has(campaignId) ? { campaignId } : {}),
    status: STATUSES.includes(e.status as EncounterStatus) ? e.status as EncounterStatus : 'draft',
    ...Object.fromEntries(LISTS.map(key => [key, (e[key] ?? []) as unknown[]])),
    createdAt: typeof e.createdAt === 'number' ? e.createdAt : now,
    updatedAt: now,
  } as PreparedEncounter;
}

/** Asks for a file and reads it as text; null when the person cancels. */
export async function pickPreparedEncounterText(): Promise<string | null> {
  if (Platform.OS === 'web') return (await pickTextFileInBrowser('.json'))?.text ?? null;
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  return FileSystem.readAsStringAsync(result.assets[0].uri);
}
