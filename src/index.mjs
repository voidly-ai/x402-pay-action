// Voidly Pay GitHub Action — pay any x402 endpoint from CI.
//
// Resolves the agent identity (env-secret OR mint+persist on the runner),
// calls fetchWithPay() against the URL, writes outputs.

import * as core from "@actions/core";
import { VoidlyPay } from "@voidly/pay";
import { decodeBase64 } from "tweetnacl-util";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

async function main() {
  const url = core.getInput("url", { required: true });
  const method = (core.getInput("method") || "GET").toUpperCase();
  const bodyRaw = core.getInput("body") || "";
  const maxAmount = parseFloat(core.getInput("max-amount-credits") || "0.05");
  const secretBase64 = core.getInput("voidly-pay-secret");
  const apiUrl = core.getInput("api-url") || "https://api.voidly.ai";
  const outputPath = core.getInput("output-path") || "";
  const failOnNon2xx = (core.getInput("fail-on-non-2xx") || "true").toLowerCase() !== "false";

  let pay;
  if (secretBase64) {
    const secret = decodeBase64(secretBase64.trim());
    pay = await VoidlyPay.create({ secretKey: secret, apiUrl });
  } else {
    pay = await VoidlyPay.create({ apiUrl });
  }
  core.info(`[voidly-pay] DID: ${pay.did}`);
  core.setOutput("did", pay.did);

  const init = { method };
  if (bodyRaw) {
    init.body = bodyRaw;
    init.headers = { "content-type": "application/json" };
  }

  core.info(`[voidly-pay] ${method} ${url}`);
  const t0 = Date.now();
  const r = await pay.fetchWithPay(url, init, {
    maxAmount,
    requireFacilitatorSignature: true,
  });
  const ms = Date.now() - t0;

  const status = r.status;
  core.setOutput("status", String(status));

  let bodyText = "";
  try {
    bodyText = await r.text();
  } catch (e) {
    bodyText = "";
  }
  // Try to parse JSON for nicer summary; fall back to raw text.
  let bodyParsed = null;
  try { bodyParsed = JSON.parse(bodyText); } catch { /* keep as text */ }

  // If the response includes a `payment` block (paid endpoints add this),
  // surface its identifiers as outputs.
  if (bodyParsed && typeof bodyParsed === "object" && bodyParsed.payment) {
    if (bodyParsed.payment.transfer_id) core.setOutput("transfer-id", String(bodyParsed.payment.transfer_id));
    if (bodyParsed.payment.amount_micro) {
      core.setOutput("amount-credits", String(bodyParsed.payment.amount_micro / 1_000_000));
    }
  }

  // Truncated body output (GitHub Action outputs are size-limited)
  const truncated = bodyText.length > 32_000 ? bodyText.slice(0, 32_000) + "...[truncated]" : bodyText;
  core.setOutput("body", truncated);
  core.setOutput("receipt-json", JSON.stringify({
    status,
    did: pay.did,
    transfer_id: bodyParsed?.payment?.transfer_id ?? null,
    quote_id: bodyParsed?.payment?.quote_id ?? null,
    amount_micro: bodyParsed?.payment?.amount_micro ?? null,
    paid: !!(bodyParsed?.payment?.transfer_id),
    duration_ms: ms,
  }));

  if (outputPath) {
    const ws = process.env.GITHUB_WORKSPACE || ".";
    const full = outputPath.startsWith("/") ? outputPath : `${ws}/${outputPath}`;
    if (!existsSync(dirname(full))) mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, bodyText);
    core.info(`[voidly-pay] body written to ${full}`);
  }

  // Step summary — readable record in the GH Actions UI.
  const summary = core.summary
    .addHeading(`Voidly Pay · ${method} ${url}`, 2)
    .addTable([
      [
        { data: "Field", header: true },
        { data: "Value", header: true },
      ],
      ["Status", String(status)],
      ["Latency (ms)", String(ms)],
      ["DID", pay.did],
      ["Transfer ID", bodyParsed?.payment?.transfer_id ?? "—"],
      ["Quote ID", bodyParsed?.payment?.quote_id ?? "—"],
      ["Amount (credits)", String(bodyParsed?.payment?.amount_micro ? bodyParsed.payment.amount_micro / 1_000_000 : 0)],
    ])
    .addRaw("\n")
    .addLink("voidly.ai/pay/for-builders", "https://voidly.ai/pay/for-builders");
  await summary.write();

  if (status >= 200 && status < 300) {
    core.info(`[voidly-pay] OK ${status} in ${ms}ms`);
  } else if (failOnNon2xx) {
    core.setFailed(`[voidly-pay] non-2xx status: ${status}`);
  } else {
    core.warning(`[voidly-pay] non-2xx status: ${status}`);
  }
}

main().catch((e) => {
  core.setFailed(`[voidly-pay] ${e?.message ?? e}`);
});
