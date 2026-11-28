"use strict";

const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { MAX_DOSSIER_BYTES } = require("./core43_cal31_replay.cjs");
const { MAX_PREPARED_BYTES, replayTechnicalPrepared } = require("./core43_cal34_replay_prepared.cjs");

if (require.main === module) {
  let result;
  try {
    const [prepared, dossier, archive, policy, expectedPreparedSha256, expectedPolicySha256] = process.argv.slice(2);
    if (process.argv.length !== 8) throw Error("cal36_usage");
    result = replayTechnicalPrepared({
      preparedBytes: readBoundedFile(prepared, MAX_PREPARED_BYTES),
      dossierBytes: readBoundedFile(dossier, MAX_DOSSIER_BYTES),
      nhlArchiveBytes: readBoundedFile(archive, 4 * 1024 * 1024),
      policyBytes: readBoundedFile(policy, 64 * 1024),
      expectedPreparedSha256, expectedPolicySha256,
    });
  } catch (error) {
    result = { trusted: false, status: "rejected", reason: error.message === "cal36_usage" ? error.message : "cal36_input_file" };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = ["technical_verified", "simulation_verified"].includes(result.status) ? 0 : 1;
}
