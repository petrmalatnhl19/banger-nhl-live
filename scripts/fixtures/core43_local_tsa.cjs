"use strict";

// Local RFC 3161 authorities for simulations only.
const { execFileSync } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const POLICY_OID = "1.3.6.1.4.1.55555.30";
const iso = time => new Date(time).toISOString();

function makeTsa(directory, id) {
  mkdirSync(directory);
  const openssl = args => execFileSync("openssl", args, { cwd: directory, stdio: "pipe" });
  const write = (name, data) => writeFileSync(join(directory, name), data);
  const read = name => readFileSync(join(directory, name));
  const caExtensions = ["-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash"];
  const issue = (name, issuer) => openssl(["x509", "-req", "-days", "3", "-CA", issuer + ".pem",
    "-CAkey", issuer + ".key", "-CAcreateserial", "-copy_extensions", "copy", "-in", name + ".csr",
    "-out", name + ".pem"]);
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "3", "-subj", "/CN=" + id + "-root",
    ...caExtensions, "-out", "root.pem", "-keyout", "root.key"]);
  openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=" + id + "-issuer",
    ...caExtensions, "-out", "issuer.csr", "-keyout", "issuer.key"]);
  issue("issuer", "root");
  openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=" + id + "-leaf",
    "-addext", "basicConstraints=critical,CA:FALSE", "-addext", "keyUsage=critical,digitalSignature",
    "-addext", "extendedKeyUsage=critical,timeStamping", "-out", "leaf.csr", "-keyout", "leaf.key"]);
  issue("leaf", "issuer");
  for (const name of ["issuer", "root"]) {
    write(name + ".index", "");
    write(name + ".cnf", `[ca]
default_ca = ca_local
[ca_local]
database = ${name}.index
certificate = ${name}.pem
private_key = ${name}.key
default_md = sha256
default_crl_days = 2
`);
  }

  function crl(issuer, start, end, revoked) {
    const args = ["ca", "-config", issuer + ".cnf"];
    if (revoked) openssl([...args, "-revoke", revoked + ".pem", "-crl_reason", "keyCompromise"]);
    const opensslTime = ms => iso(ms).replace(/[-:]/g, "").replace("T", "").replace(".000", "");
    return openssl([...args, "-gencrl", "-crl_lastupdate", opensslTime(start), "-crl_nextupdate", opensslTime(end)]);
  }

  write("serial", "01\n");
  write("tsa.cnf", `[tsa]
default_tsa = tsa_local
[tsa_local]
serial = serial
signer_cert = leaf.pem
signer_key = leaf.key
certs = issuer.pem
signer_digest = sha256
default_policy = ${POLICY_OID}
digests = sha256
accuracy = secs:1
clock_precision_digits = 0
ordering = no
tsa_name = yes
ess_cert_id_chain = no
ess_cert_id_alg = sha256
`);
  function respond(request) {
    write("request.tsq", request);
    openssl(["ts", "-reply", "-config", "tsa.cnf", "-queryfile", "request.tsq", "-out", "response.tsr"]);
    return read("response.tsr");
  }

  function evidence(packageBytes, start, end) {
    write("package", packageBytes);
    openssl(["ts", "-query", "-data", "package", "-sha256", "-cert", "-out", "request.tsq"]);
    const request = read("request.tsq");
    return { id, chain: ["leaf.pem", "issuer.pem", "root.pem"].map(read),
      crls: [crl("issuer", start, end), crl("root", start, end)],
      approval: Buffer.from("synthetic review record for " + id),
      request, response: respond(request) };
  }
  return { evidence, crl, respond };
}

module.exports = { makeTsa, POLICY_OID };
