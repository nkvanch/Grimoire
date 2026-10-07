// Builds the two first-party SRD packs into release/packs/ (and assets/packs/ for the app to bundle) (see src/content/packs/srdPacks.ts).
//   npx tsx scripts/build-srd-packs.ts
import fs from 'fs';
import path from 'path';
import { buildSrd51Pack, buildSrd521Pack, serializePack } from '../src/content/packs/srdPacks';
import { signPack } from '../src/content/packSigning';

const outDir = path.join(__dirname, '..', 'release', 'packs');

// Every pack is signed with the key in release/keys/pack-signing.key (npx tsx scripts/make-pack-signing-key.ts) when it exists.
// The signature is deterministic, so rebuilding an unchanged pack gives the same file. Without the key the packs are unsigned and
// the app asks before installing them (the bundled ones are refused).
const keyFile = path.join(__dirname, '..', 'release', 'keys', 'pack-signing.key');
const signingKey: { keyId: string; privateKey: string } | null = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')) : null;
if (!signingKey) console.warn('No signing key (release/keys/pack-signing.key): the packs are NOT signed.');
const sign = <T extends { manifest: import('../src/engine/contentPackManifest').ContentPackManifest }>(pack: T): T => (signingKey ? signPack(pack, signingKey.keyId, signingKey.privateKey) : pack);
fs.mkdirSync(outDir, { recursive: true });
for (const pack of [buildSrd51Pack(), buildSrd521Pack()].map(sign)) {
  const file = path.join(outDir, `${pack.manifest.id}-${pack.manifest.version}.grimoire-pack`);
  fs.writeFileSync(file, serializePack(pack));
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`${pack.manifest.id} ${pack.manifest.version}: ${kb} KB, hash ${pack.manifest.contentHash.slice(0, 12)}, ${JSON.stringify(pack.manifest.counts)}${pack.manifest.signature ? ', signed ' + pack.manifest.signature.keyId : ', UNSIGNED'}`);
  // The same packs, as the files the app ships and offers to install (src/content/bundledPacks.ts). Tracked in git so the
  // bundle is reproducible; a test fails if they fall behind the content they are built from.
  const assetDir = path.join(__dirname, '..', 'assets', 'packs');
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, `${pack.manifest.id}.json`), serializePack(pack));
}
