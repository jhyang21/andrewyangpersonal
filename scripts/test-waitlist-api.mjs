#!/usr/bin/env node

const BASE_URL = process.env.WAITLIST_API_BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL.replace(/\/$/, "")}/api/waitlist`;
const MODE = process.argv[2] ?? "--all";

const validPayloadBase = {
  identity: "Founder or executive",
  emotionalHook: "Often",
  goldInsight: "I forgot they were moving cities next month.",
  featureSignal: ["Smart follow-up reminders", "Search across people"],
  commitment: "Yes, I want early access",
  company: "",
};

function makeUniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function submit(email) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...validPayloadBase,
      email,
    }),
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = { message: await response.text() };
  }

  return { status: response.status, headers: response.headers, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runBasicFlowTest() {
  const email = makeUniqueEmail("waitlist-basic");
  console.log(`\n[Basic] Testing created/updated flow with ${email}`);

  const first = await submit(email);
  console.log(`[Basic] First submit -> status ${first.status}, code: ${first.body?.code ?? "n/a"}`);
  assert(first.status === 200, "Expected first submit status to be 200.");
  assert(first.body?.code === "created", "Expected first submit code to be 'created'.");

  const second = await submit(email);
  console.log(`[Basic] Second submit -> status ${second.status}, code: ${second.body?.code ?? "n/a"}`);
  assert(second.status === 200, "Expected second submit status to be 200.");
  assert(second.body?.code === "updated", "Expected second submit code to be 'updated'.");

  console.log("[Basic] PASS");
}

async function runRateLimitTest() {
  const email = makeUniqueEmail("waitlist-rate");
  console.log(`\n[RateLimit] Testing per-email limiter with ${email}`);

  let saw429 = false;
  const attempts = 8;

  for (let i = 1; i <= attempts; i += 1) {
    const result = await submit(email);
    const retryAfter = result.headers.get("retry-after");
    console.log(
      `[RateLimit] Attempt ${i} -> status ${result.status}, code: ${result.body?.code ?? "n/a"}, retry-after: ${retryAfter ?? "n/a"}`,
    );

    if (result.status === 429) {
      saw429 = true;
      assert(result.body?.code === "rate_limited", "Expected 429 response code to be 'rate_limited'.");
      assert(Boolean(retryAfter), "Expected 429 response to include Retry-After header.");
      break;
    }
  }

  assert(saw429, "Expected to hit rate limit (429), but it never occurred.");
  console.log("[RateLimit] PASS");
}

async function main() {
  console.log(`Running waitlist API checks against: ${ENDPOINT}`);
  console.log("Tip: start your app first with `npm run dev`.");

  if (MODE === "--basic") {
    await runBasicFlowTest();
    return;
  }

  if (MODE === "--rate-limit") {
    await runRateLimitTest();
    return;
  }

  await runBasicFlowTest();
  await runRateLimitTest();
}

main().catch((error) => {
  console.error(`\nFAIL: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
});
