"use strict";

const { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } = require("node:crypto");
const { chmodSync, mkdirSync, realpathSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve, sep } = require("node:path");

const sha = bytes => createHash("sha256").update(bytes).digest("hex");

function publicPin(key) {
  const pub = createPublicKey(key);
  if (pub.asymmetricKeyType !== "ed25519") throw Error("An Ed25519 signing key is required");
  return sha(pub.export({ type: "spki", format: "der" }));
}

function validatedSecrets(signing, archive, pins) {
  try {
    if (typeof signing !== "string" || !/^[a-f0-9]{64}$/i.test(archive ?? "")) throw Error();
    const key = createPrivateKey(signing);
    if (key.asymmetricKeyType !== "ed25519") throw Error();
    const symmetric = Buffer.from(archive, "hex");
    if (pins && (publicPin(key) !== pins.signer || sha(symmetric) !== pins.archive)) throw Error();
    return { key, symmetric };
  } catch {
    throw Error("Missing, invalid or unpinned pilot key");
  }
}

function generate(destination, repo = join(__dirname, "..")) {
  const parent = realpathSync(dirname(resolve(destination)));
  const dir = join(parent, resolve(destination).split(sep).at(-1));
  const worktree = realpathSync(repo);
  if (dir === worktree || dir.startsWith(worktree + sep)) throw Error("Key directory must be outside the repository");
  mkdirSync(dir, { mode: 0o700 });
  try {
    chmodSync(dir, 0o700);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const archive = randomBytes(32);
    const metadata = { signingSpkiSha256: publicPin(privateKey), archiveKeySha256: sha(archive) };
    const save = (name, bytes) => writeFileSync(join(dir, name), bytes, { flag: "wx", mode: 0o600, flush: true });
    save("signing.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
    save("signing-public.pem", publicKey.export({ type: "spki", format: "pem" }));
    save("archive.hex", archive.toString("hex"));
    save("pins.json", JSON.stringify(metadata) + "\n");
    return metadata;
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  const [command, destination] = process.argv.slice(2);
  try {
    if (command !== "generate" || !destination) throw Error("Usage: pilot-keys.cjs generate NEW_DIRECTORY_OUTSIDE_REPO");
    console.log(JSON.stringify(generate(destination)));
  } catch {
    console.error("Key generation failed. Select a new protected directory outside the repository.");
    process.exitCode = 1;
  }
}

module.exports = { publicPin, validatedSecrets, generate };
