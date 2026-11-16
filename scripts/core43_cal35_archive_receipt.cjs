"use strict";

const { createHash, createPrivateKey, createPublicKey, sign, verify } = require("node:crypto");
const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { readRegistry } = require("./core43_cal13_coordinator.cjs");
const { readPolicy } = require("./core43_cal30_historical_trust.cjs");
const { MAX_DOSSIER_BYTES } = require("./core43_cal31_replay.cjs");
const { replayPrepared, readPrepared, MAX_PREPARED_BYTES } = require("./core43_cal34_replay_prepared.cjs");

const SCHEMA = "core43_cal35_archive_receipt_v1";
const MAX_RECEIPT_BYTES = 4096;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value));
const encode = bytes => bytes.toString("base64url");
const publicDer = key => key.export({ type: "spki", format: "der" });
const signedMessage = statement => Buffer.concat([Buffer.from(SCHEMA + "\0"), json(statement)]);
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

function check(condition, reason) {
  if (!condition) throw Error("cal35_" + reason);
}

function fields(value, names) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function validateStatement(statement) {
  check(fields(statement, ["schema", "gameId", "kickoffAt", "planSha256", "archiveSha256", "custodyRef", "receivedAt"]) &&
    statement.schema === SCHEMA && typeof statement.gameId === "string" && /^\d{10}$/.test(statement.gameId) &&
    statement.gameId.length === 10 &&
    [statement.planSha256, statement.archiveSha256].every(pin => typeof pin === "string" && /^[a-f0-9]{64}$/.test(pin) &&
      pin.length === 64) &&
    typeof statement.custodyRef === "string" && /^[a-z0-9][a-z0-9._:-]{2,127}$/i.test(statement.custodyRef) &&
    !/\s/.test(statement.custodyRef) && [statement.receivedAt, statement.kickoffAt].every(instant) &&
    statement.receivedAt < statement.kickoffAt, "receipt_format");
}

function assertArchiveBinding(statement, prepared) {
  check(statement.gameId === prepared.gameId && statement.kickoffAt === prepared.kickoffAt &&
    statement.planSha256 === prepared.planSha256 && instant(prepared.preparedAt) &&
    prepared.preparedAt <= statement.receivedAt, "receipt_binding");
}

function signArchiveReceipt(preparedBytes, custodyRef, privateKey, clock = Date.now) {
  check(privateKey?.type === "private" && privateKey.asymmetricKeyType === "ed25519", "custodian_key");
  check(Buffer.isBuffer(preparedBytes) && preparedBytes.length > 0 &&
    preparedBytes.length <= MAX_PREPARED_BYTES, "prepared_bytes");
  const archiveSha256 = hash(preparedBytes);
  const prepared = readPrepared(preparedBytes, archiveSha256);
  const statement = { schema: SCHEMA, gameId: prepared.gameId, kickoffAt: prepared.kickoffAt,
    planSha256: prepared.planSha256, archiveSha256, custodyRef, receivedAt: new Date(clock()).toISOString() };
  validateStatement(statement);
  assertArchiveBinding(statement, prepared);
  return { statement, signature: encode(sign(null, signedMessage(statement), privateKey)) };
}

function verifyReceipt(receiptBytes, custodianKey, expectedCustodianSha256) {
  check(custodianKey?.type === "public" && custodianKey.asymmetricKeyType === "ed25519" &&
    hash(publicDer(custodianKey)) === expectedCustodianSha256, "custodian_pin");
  check(Buffer.isBuffer(receiptBytes) && receiptBytes.length > 0 && receiptBytes.length <= MAX_RECEIPT_BYTES, "receipt_format");
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(receiptBytes).replace(/\n$/, "");
  const receipt = JSON.parse(text);
  check(JSON.stringify(receipt) === text && fields(receipt, ["statement", "signature"]) &&
    typeof receipt.signature === "string" && /^[A-Za-z0-9_-]{86}$/.test(receipt.signature), "receipt_format");
  validateStatement(receipt.statement);
  const signature = Buffer.from(receipt.signature, "base64url");
  check(signature.length === 64 && encode(signature) === receipt.signature &&
    verify(null, signedMessage(receipt.statement), custodianKey, signature), "receipt_signature");
  return receipt.statement;
}

function checkRoleSeparation(prepared, policy, keyPin) {
  const { rootKey, source, registrySha256 } = policy.packageRegistry;
  const registry = Buffer.from(prepared.registryBytes, "base64url");
  check(hash(registry) === registrySha256 && encode(registry) === prepared.registryBytes, "registry_pin");
  const root = createPublicKey({ key: Buffer.from(rootKey, "base64url"), type: "spki", format: "der" });
  const { keys } = readRegistry(JSON.parse(registry), { rootKey: root, source, origin: policy.mode });
  check(keyPin !== hash(publicDer(root)) && keyPin !== hash(Buffer.from(policy.nhlObserver.publicKey, "base64url")) &&
    [...keys.values()].every(key => keyPin !== key.fingerprint), "custodian_independence");
}

function replayReceipted({ preparedBytes, dossierBytes, policyBytes, expectedPolicySha256,
  receiptBytes, custodianKey, expectedCustodianSha256 } = {}) {
  try {
    const statement = verifyReceipt(receiptBytes, custodianKey, expectedCustodianSha256);
    const prepared = readPrepared(preparedBytes, statement.archiveSha256);
    assertArchiveBinding(statement, prepared);
    const policy = readPolicy(policyBytes, expectedPolicySha256);
    checkRoleSeparation(prepared, policy, expectedCustodianSha256);
    const result = replayPrepared({ preparedBytes, dossierBytes, policyBytes, expectedPolicySha256,
      expectedPreparedSha256: statement.archiveSha256 });
    if (result.cutoffAt) check(statement.receivedAt < result.cutoffAt, "late_archive_receipt");
    return { ...result, archiveReceiptSha256: hash(receiptBytes), custodyRef: statement.custodyRef };
  } catch (error) {
    const reason = /^cal(?:13|30|34|35)_[a-z_]+$/.test(error?.message) ? error.message : "cal35_input_format";
    return { trusted: false, status: "rejected", reason };
  }
}

if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "sign" && args.length === 3) {
      const [preparedPath, keyPath, custodyRef] = args;
      const result = signArchiveReceipt(readBoundedFile(preparedPath, MAX_PREPARED_BYTES), custodyRef,
        createPrivateKey(readBoundedFile(keyPath, MAX_RECEIPT_BYTES)));
      process.stdout.write(JSON.stringify(result) + "\n");
    } else if (command === "replay" && args.length === 7) {
      const [preparedPath, dossierPath, policyPath, expectedPolicySha256, receiptPath, keyPath, expectedCustodianSha256] = args;
      const result = replayReceipted({
        preparedBytes: readBoundedFile(preparedPath, MAX_PREPARED_BYTES),
        dossierBytes: readBoundedFile(dossierPath, MAX_DOSSIER_BYTES),
        policyBytes: readBoundedFile(policyPath, 64 * 1024),
        expectedPolicySha256,
        receiptBytes: readBoundedFile(receiptPath, MAX_RECEIPT_BYTES),
        custodianKey: createPublicKey(readBoundedFile(keyPath, MAX_RECEIPT_BYTES)),
        expectedCustodianSha256,
      });
      process.stdout.write(JSON.stringify(result) + "\n");
      process.exitCode = result.trusted ? 0 : 1;
    } else {
      throw Error("cal35_usage");
    }
  } catch (error) {
    const reason = /^cal(?:34|35)_[a-z_]+$/.test(error?.message) ? error.message : "cal35_input_file";
    process.stdout.write(JSON.stringify({ trusted: false, status: "rejected", reason }) + "\n");
    process.exitCode = 1;
  }
}

module.exports = { signArchiveReceipt, replayReceipted };
