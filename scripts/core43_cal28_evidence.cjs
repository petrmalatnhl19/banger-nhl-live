"use strict";
// CAL-28B: require independently available, verified CAL-18B archives for every ledger entry.
const { lstatSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { verifyTransfer } = require("./core43_cal22_transfer.cjs");
const { verifyArchive } = require("./core43_cal18_archive.cjs");
const HEX = /^[a-f0-9]{64}$/;
function verifyTransferEvidence(transfer, trustedKey, witnessId, anchor, archiveRoot) {
  const verified = verifyTransfer(transfer, trustedKey, witnessId, anchor);
  if (typeof archiveRoot !== "string" || !archiveRoot) throw Error("cal28b_archive_root_required");
  const root = resolve(archiveRoot);
  const rootStat = lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw Error("cal28b_unsafe_archive_root");
  const identities = [];
  const identity = s => [s.dev, s.ino, s.ctimeMs].join(":");
  const rootIdentity = identity(rootStat);
  for (const entry of transfer.ledger) {
    if (!HEX.test(entry.archiveDigest)) throw Error("cal28b_invalid_digest");
    const path = join(root, entry.archiveDigest);
    let stat;
    try { stat = lstatSync(path); }
    catch (_) { throw Error("cal28b_missing_archive:" + entry.seq); }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("cal28b_unsafe_archive:" + entry.seq);
    let manifest;
    try { manifest = verifyArchive(path); }
    catch (_) { throw Error("cal28b_invalid_archive:" + entry.seq); }
    if (manifest.packageDigest !== entry.archiveDigest) throw Error("cal28b_digest_mismatch:" + entry.seq);
    const after = lstatSync(path);
    if (!after.isDirectory() || after.isSymbolicLink() || identity(after) !== identity(stat))
      throw Error("cal28m_archive_directory_changed:" + entry.seq);
    identities.push({ seq: entry.seq, identity: identity(after) });
  }
  const rootAfter = lstatSync(root);
  if (!rootAfter.isDirectory() || rootAfter.isSymbolicLink() || identity(rootAfter) !== rootIdentity)
    throw Error("cal28m_archive_root_changed");
  return { ...verified, archivesVerified: transfer.ledger.length, evidenceStatus: "verified",
    archiveDirectoryIdentities: { root: rootIdentity, entries: identities } };
}
module.exports = { verifyTransferEvidence };
