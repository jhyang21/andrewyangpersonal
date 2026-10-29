# The cup note: simulation spec and data contract

This file is the contract between the Python generator (`simulation/`) and the Next.js page
(`src/app/projects/cup-notes`, `src/components/projects/cup-notes`). Both sides implement it exactly.
If something here is ambiguous, ask; do not guess in one place and hope the other side matches.

## 1. What is simulated

A corporate policy (handwritten notes on cups) passes through three layers of people:

    Policy → Store manager → Barista → Customer → Outcomes

Each layer is one model call per person per scenario, run in advance through the OpenAI Batch API
(`config/model.json`: `gpt-6-luna`, `reasoning_effort: "low"`). The page replays saved results only.

## 2. Levers and scenarios

Four levers, defined with their copy in `config/levers.json`:

| lever | options |
|---|---|
| `enforcement` | `strict`, `flexible`, `adaptive` |
| `note` | `mark`, `personal` |
| `traffic` | `steady`, `rush` |
| `staffing` | `full`, `short` |

Scenario key = `f"{enforcement}-{note}-{traffic}-{staffing}"`. The full grid is 24 scenarios, generated
in the order `itertools.product` gives over the lever option lists as written in `levers.json`.

## 3. Population (`config/personas.json`)

6 stores, each with 1 manager and 2 baristas (12 baristas); 8 customer archetypes. The population is
identical in every scenario, so differences between scenarios come from the policy and the conditions,
not from different people.

## 4. World rules (deterministic, `cupnotes/world.py`)

`SEED = 20261028` (from `config/model.json`). All randomness uses `random.Random(f"{SEED}|{...}")`
with a string seed naming the entity, so results do not depend on call order.

**Seating.** Each barista serves 8 customers per shift, one of each archetype, in a fixed order:
`random.Random(f"{SEED}|seat|{store_key}|{barista_key}").shuffle(list_of_8_customer_keys)`. Seating does
not depend on the scenario.

**Queue depth per slot** (people waiting when the barista starts slot `i`, 0-based):

    base_steady = [2, 3, 3, 4, 3, 2, 2, 1]
    base_rush   = [4, 8, 11, 12, 9, 6, 4, 3]
    queue[i] = clamp(base[i] + store.traffic_modifier + (2 if staffing == "short" else 0), 1, 15)

**Service time.** `service_seconds = 50` if staffing is `full`, `65` if `short`.

**Wait.** For slot `i`, after the barista's decisions are known:

    running_mean = mean(seconds_added[0..i])          # includes the current cup
    wait_min[i]  = round(queue[i] * (service_seconds + running_mean) / 60, 1)

The customer prompt shows `wait_text`: `"{n} minutes"` with `n = max(1, round(wait_min))`, or
`"a minute"` when `n == 1`.

**Cup text** shown to the customer, by action:

| action | `cup_text` |
|---|---|
| `skip` | `There is nothing on your cup but your name.` |
| `smiley` | `The barista drew a quick {note_text} on your cup.` → render as `The barista drew a quick smiley on your cup.` (do not echo the symbol) |
| `generic` | `The barista wrote on your cup: "{note_text}"` |
| `personal` | `The barista wrote on your cup: "{note_text}"` |

**Manager → barista text.** `tracks_text` = `"will be checking cups today"` if `tracks_compliance`
else `"is not checking cups today"`. `peak_text` = `"Your manager said partners may skip the note
during a rush."` if `peak_exception` else `""`.

**Policy text.** `enforcement_policy` and `note_policy` are the `policy_text` fields from
`levers.json`. `traffic_description` and `staffing_description` are the `description` fields.
`tenure_text` for a manager: `"{tenure_years:g} years"`, or `"four months"` when `tenure_years < 1`.

**Customer lines** for the barista prompt, one per slot:
`f"{i+1}. ({queue[i]} waiting) {customer.label}: {customer.cues}"`.

## 5. Stage outputs (strict JSON schemas, `cupnotes/schemas.py`)

All schemas: every property required, `additionalProperties: false`, nullable via `["string","null"]`.
Run a strict-mode guard before submitting (synthshop `agent.strict_schema_errors` idea).

### `ManagerDecision`
```
stance: "enforce_all" | "enforce_offpeak" | "encourage" | "ignore"
intensity: int 0..100
tracks_compliance: bool
peak_exception: bool
message_to_team: str (≤ 320 chars)
private_thought: str (≤ 200 chars)
expected_friction: int 0..100
```

### `BaristaShift`
```
cups: array of exactly 8 CupDecision
stress: int 0..100
sentiment: int 0..100
quote: str (≤ 320 chars)

CupDecision:
  action: "skip" | "smiley" | "generic" | "personal"
  note_text: str | null (≤ 40 chars; null iff action == "skip"; coerce on ingest, do not fail:
             a skip with text drops the text, a generic/personal cup with empty text becomes a skip)
  seconds_added: int 0..45
```
If the model returns fewer or more than 8 cups, ingest records `schema_ok: false` for that shift and
the compile step fills the shift from the fixture backend **and marks the scenario
`has_fallback: true`** so the UI can show it. (Expected to be rare; the schema uses minItems/maxItems 8.)

### `CustomerReaction`
```
noticed: bool
reaction: "delighted" | "warm" | "neutral" | "indifferent" | "annoyed"
satisfaction: int 0..100
connection: int 0..100
wait_annoyance: int 0..100
would_mention: bool
quote: str (≤ 240 chars)
```

## 6. Batch mechanics (`cupnotes/batch.py`, `run.py`)

Three stages, each one batch, each depending on the previous stage's ingested responses:

| stage | calls | custom_id |
|---|---|---|
| `manager` | 24 × 6 = 144 | `m|{scenario}|{store}` |
| `barista` | 24 × 12 = 288 | `b|{scenario}|{store}|{barista}` |
| `customer` | 24 × 96 = 2,304 | `c|{scenario}|{store}|{barista}|{slot}` |

Longest id is 55 chars (limit 64). One JSONL request line:

```json
{"custom_id": "...", "method": "POST", "url": "/v1/chat/completions",
 "body": {"model": "gpt-6-luna", "reasoning_effort": "low",
          "messages": [{"role":"system","content":"..."},{"role":"user","content":"..."}],
          "response_format": {"type":"json_schema","json_schema":{"name":"...","strict":true,"schema":{...}}},
          "max_completion_tokens": 1200}}
```

No `temperature`. Run a 2-request probe batch for the manager stage first; if the API rejects
`reasoning_effort`, try `reasoning: {"effort": "low"}` and record which worked in `runs/probe/`.

CLI: `python run.py build <stage>` | `submit <stage>` | `poll <stage>` | `ingest <stage>` |
`compile [--fixture]` | `status`. Each stage writes to `runs/<stage>/`:

```
batch_inputs/requests.jsonl   what was sent
keys.jsonl                    custom_id → scenario, store, barista, slot
responses.jsonl               {custom_id, batch_id, raw_text, parsed, usage, error, schema_ok}
manifest.json                 model, prompt_version, batch_ids, status, counts, tokens, usd, timestamps
status.log
```

`build` skips custom_ids already present in `responses.jsonl` (resume). `ingest` validates with the
pydantic models and never drops a line. `.env` in `simulation/` holds `OPENAI_API_KEY`; parse it with a
few lines of code, no extra dependency. Never write the key anywhere.

## 7. Compile (`cupnotes/compile.py`)

Writes two kinds of file. Paths are relative to the repo root.

### `content/cup-notes/index.json`

```ts
type CupNotesIndex = {
  meta: {
    source: "openai-batch" | "fixture";
    model: string; reasoning_effort: string; prompt_version: string;
    generated_at: string;                 // ISO 8601 UTC
    counts: { scenarios: number; manager_calls: number; barista_calls: number; customer_calls: number };
    tokens: { input: number; output: number };
    usd: number;
    batch_ids: string[];                  // [] for fixture
    schema_failures: number;
    disclaimer: string;                   // "Synthetic and illustrative. Generated by a language model playing invented people. Not Starbucks data and not a prediction."
  };
  levers: {
    enforcement: LeverOption[]; note: LeverOption[]; traffic: LeverOption[]; staffing: LeverOption[];
  };
  stores: Array<{
    key: string; name: string; type_label: string; setting: string;
    manager: { name: string; style: string; style_label: string; tenure_years: number; judged_on: string; blurb: string };
    baristas: Array<{ key: string; name: string; tenure: string; blurb: string }>;
  }>;
  customers: Array<{ key: string; label: string; blurb: string }>;
  scenarios: ScenarioSummary[];           // all 24, same order as generated
};

type LeverOption = { key: string; label: string; short: string };   // policy_text/description stay server-side

type Outcomes = {
  compliance_pct: number;        // cups with any mark (smiley, generic, personal) / 96
  personal_pct: number;          // personal / 96
  skip_pct: number;
  avg_seconds_added: number;     // mean seconds_added per cup
  avg_wait_min: number;          // mean wait_min over the 96 customers
  barista_sentiment: number;     // mean over 12
  barista_stress: number;
  customer_satisfaction: number; // mean over 96
  connection: number;
  noticed_pct: number;
  delighted_pct: number;         // reaction == delighted
  annoyed_pct: number;
  would_mention_pct: number;
};

type ScenarioSummary = {
  key: string;
  levers: { enforcement: string; note: string; traffic: string; staffing: string };
  outcomes: Outcomes;
  stance_mix: { enforce_all: number; enforce_offpeak: number; encourage: number; ignore: number };  // counts, sum 6
  by_store: Array<{ store: string; compliance_pct: number; avg_wait_min: number;
                    customer_satisfaction: number; connection: number; barista_sentiment: number }>;
  has_fallback: boolean;
};
```

Percentages are 0–100 with one decimal. Means are one decimal.

### `public/cup-notes/scenarios/{key}.json`

```ts
type ScenarioDetail = {
  key: string;
  levers: ScenarioSummary["levers"];
  outcomes: Outcomes;
  has_fallback: boolean;
  managers: Array<{
    store: string;
    stance: "enforce_all" | "enforce_offpeak" | "encourage" | "ignore";
    intensity: number; tracks_compliance: boolean; peak_exception: boolean;
    message_to_team: string; private_thought: string; expected_friction: number;
  }>;                                   // 6, store order as in personas.json
  shifts: Array<{
    store: string; barista: string;
    stress: number; sentiment: number; quote: string;
    fallback: boolean;                  // true if this shift came from the fixture backend
    cups: Array<{
      slot: number;                     // 0..7
      customer: string;                 // archetype key
      queue: number;
      action: "skip" | "smiley" | "generic" | "personal";
      note_text: string | null;
      seconds_added: number;
      wait_min: number;
      reaction: {
        noticed: boolean;
        reaction: "delighted" | "warm" | "neutral" | "indifferent" | "annoyed";
        satisfaction: number; connection: number; wait_annoyance: number;
        would_mention: boolean; quote: string;
      };
    }>;                                 // 8
  }>;                                   // 12, store order then barista order
};
```

## 8. Fixture backend (`cupnotes/fake.py`)

`python run.py compile --fixture` produces both files with `meta.source = "fixture"` from rule-based
answers so the page can be built before the batches return. Rules should be plausible and vary with
the levers (strict + tracked → more notes; rush + short → more skips and higher stress; skeptic +
generic → annoyed), with small template pools for quotes seeded per entity. The page shows a red
"FIXTURE DATA" band when it sees `source == "fixture"`, and `npm run check:dataset` fails the build.

## 9. What the page must never do

- Call a model.
- Show a number or quote that is not in the dataset.
- Render a lever combination that has no scenario file as if it were simulated. Missing → a card
  that says the combination was not simulated.
