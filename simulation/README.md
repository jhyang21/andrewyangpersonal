# The cup note: simulation

Generates the dataset behind the cup note project page. `SPEC.md` is the contract; read it first.

Three OpenAI Batch stages run in order, each feeding the next:

    manager (144 calls) -> barista (288 calls) -> customer (2,304 calls) -> compile

## Setup

```bash
cd simulation
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # .venv/bin/python on macOS/Linux
cp .env.example .env                                      # then fill in OPENAI_API_KEY
```

## Fixture data (no API key needed)

```bash
.venv/Scripts/python run.py compile --fixture
```

Writes rule-based data with `meta.source = "fixture"`, so the page can be built before any batch runs.

## Real run

```bash
python run.py probe                 # 2 manager requests -> runs/probe/requests.jsonl
python run.py probe --submit
python run.py poll probe
python run.py ingest probe          # passes -> runs/probe/works.json records the reasoning param
#   if the error names reasoning_effort: python run.py probe --alt, then submit/poll/ingest again

python run.py build manager && python run.py submit manager
python run.py poll manager && python run.py ingest manager
python run.py build barista  && python run.py submit barista      # needs manager responses
python run.py poll barista  && python run.py ingest barista
python run.py build customer && python run.py submit customer     # needs barista responses
python run.py poll customer && python run.py ingest customer
python run.py compile
python run.py status                # any time
```

`build` skips custom_ids that already have an answer and rebuilds the ones that errored, so a
partial or expired batch can be resumed by running build, submit, poll and ingest again.
`submit` refuses to send the same file twice unless you pass `--force`.

## Cost

About 1.9M input tokens over all three stages (chars/4 estimate). With output at 400 to 1,000
tokens per call, the whole run costs about $0.40 at the batch prices in `config/model.json`. If
every call used its full 1,200 completion tokens, it would cost about $0.92.

## Outputs

- `runs/<stage>/`: requests sent, custom_id keys, raw responses, manifest with tokens and dollars,
  and a status log.
- `../content/cup-notes/index.json`: lever copy, people, and the 24 scenario summaries.
- `../public/cup-notes/scenarios/<key>.json`: every manager, shift, cup and customer reaction for one
  scenario.

An answer that fails validation is kept in `responses.jsonl` with `schema_ok: false`. Compile fills
it from the fixture backend and marks the scenario `has_fallback: true`.

## Tests

```bash
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -m ruff check .
```
