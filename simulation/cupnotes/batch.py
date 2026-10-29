"""OpenAI Batch round trips per stage (SPEC section 6): build, submit, poll, ingest.

Layout per stage, under runs/<stage>/:
    batch_inputs/requests.jsonl   what was sent
    keys.jsonl                    custom_id -> scenario, store, barista, slot
    responses.jsonl               {custom_id, raw_text, usage, error, schema_ok, parsed, batch_id}
    manifest.json                 model, prompt_version, batch_ids, status, counts, tokens, usd, timestamps
    status.log

The probe is a fourth "stage" in runs/probe/ holding the first two manager requests.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

from pydantic import ValidationError

from . import config, fake, prompts, schemas, world

STAGES = ("manager", "barista", "customer")
NEEDS = {"barista": "manager", "customer": "barista"}
TERMINAL = {"completed", "failed", "expired", "cancelled"}
PROBE = "probe"


class StageError(Exception):
    """A stage cannot run yet. The message says why and what to do."""


# ---------------------------------------------------------------- files


def now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def run_dir(stage: str) -> Path:
    return config.RUNS_DIR / stage


def requests_path(stage: str) -> Path:
    if stage == PROBE:
        return run_dir(PROBE) / "requests.jsonl"
    return run_dir(stage) / "batch_inputs" / "requests.jsonl"


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def write_jsonl(rows: list[dict], path: Path, mode: str = "w") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open(mode, encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def read_manifest(stage: str) -> dict:
    path = run_dir(stage) / "manifest.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def write_manifest(stage: str, manifest: dict) -> None:
    path = run_dir(stage) / "manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    manifest["updated_at"] = now()
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def log(stage: str, message: str) -> None:
    path = run_dir(stage) / "status.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(f"{now()} {message}\n")
    print(f"[{stage}] {message}")


def load_responses(stage: str) -> dict[str, dict]:
    """custom_id -> response row. A later line for the same id wins (a retried error)."""
    return {row["custom_id"]: row for row in read_jsonl(run_dir(stage) / "responses.jsonl")}


# ---------------------------------------------------------------- answers or fallback
# Each resolver returns (answer, fell_back). `responses` None means fixture mode:
# every answer comes from fake.py and nothing counts as a fallback.


def _answer(responses: dict | None, custom_id: str):
    if responses is None:
        return None, False
    row = responses.get(custom_id)
    if row and row.get("schema_ok"):
        return row["parsed"], False
    return None, True


def resolve_manager(scenario: str, store_key: str, responses: dict | None) -> tuple[dict, bool]:
    answer, fell_back = _answer(responses, world.manager_id(scenario, store_key))
    return answer or fake.manager(scenario, store_key), fell_back


def resolve_shift(scenario: str, store_key: str, barista_key: str, decision: dict,
                  responses: dict | None) -> tuple[dict, bool]:
    answer, fell_back = _answer(responses, world.barista_id(scenario, store_key, barista_key))
    return answer or fake.shift(scenario, store_key, barista_key, decision), fell_back


def shift_slots(scenario: str, store_key: str, barista_key: str, cups: list[dict]) -> list[dict]:
    """Per slot: customer, queue depth and wait, once the barista's cups are known."""
    lv = world.scenario_levers(scenario)
    depths = world.queue(lv["traffic"], lv["staffing"], config.store(store_key)["traffic_modifier"])
    waits = world.waits(depths, [c["seconds_added"] for c in cups], lv["staffing"])
    seats = world.seating(store_key, barista_key)
    return [
        {"slot": i, "customer": seats[i], "queue": depths[i], "wait_min": waits[i]}
        for i in range(world.SLOTS)
    ]


def resolve_reaction(scenario: str, store_key: str, barista_key: str, slot: dict, cup: dict,
                     responses: dict | None) -> tuple[dict, bool]:
    cid = world.customer_id(scenario, store_key, barista_key, slot["slot"])
    answer, fell_back = _answer(responses, cid)
    return answer or fake.reaction(scenario, store_key, barista_key, slot["slot"], slot["customer"],
                                   cup, slot["queue"], slot["wait_min"]), fell_back


# ---------------------------------------------------------------- build


def reasoning_fields() -> dict:
    """Which reasoning parameter shape the API accepts, as recorded by the probe."""
    works = run_dir(PROBE) / "works.json"
    style = "reasoning_effort"
    if works.exists():
        style = json.loads(works.read_text(encoding="utf-8"))["reasoning_param"]
    return reasoning_shape(style)


def reasoning_shape(style: str) -> dict:
    effort = config.model()["reasoning_effort"]
    if style == "reasoning":
        return {"reasoning": {"effort": effort}}
    return {"reasoning_effort": effort}


def request_line(custom_id: str, stage: str, messages: list[dict], reasoning: dict) -> dict:
    cfg = config.model()
    body = {
        "model": cfg["model"],
        **reasoning,
        "messages": messages,
        "response_format": schemas.response_format(stage),
        "max_completion_tokens": cfg["max_completion_tokens"][stage],
    }
    return {"custom_id": custom_id, "method": "POST", "url": cfg["endpoint"], "body": body}


def _require(stage: str) -> dict:
    """The previous stage's responses, covering every one of its custom_ids."""
    prev = NEEDS[stage]
    keys = [k["custom_id"] for k in read_jsonl(run_dir(prev) / "keys.jsonl")]
    responses = load_responses(prev)
    if not keys or not responses:
        raise StageError(
            f"{stage} needs ingested {prev} responses. Run: build/submit/poll/ingest {prev} first."
        )
    missing = [k for k in keys if k not in responses]
    if missing:
        raise StageError(
            f"{stage} needs every {prev} response; {len(missing)} of {len(keys)} are missing "
            f"(first: {missing[0]}). Rebuild, submit, poll and ingest {prev} to fill them."
        )
    return responses


def stage_requests(stage: str, reasoning: dict) -> tuple[list[dict], list[dict]]:
    """Every (request line, key row) for a stage, in scenario/store/barista/slot order."""
    lines, keys = [], []

    def add(cid: str, messages: list[dict], **key):
        lines.append(request_line(cid, "manager" if stage == PROBE else stage, messages, reasoning))
        keys.append({"custom_id": cid, "scenario": None, "store": None, "barista": None,
                     "slot": None, **key})

    if stage in ("manager", PROBE):
        for sc in world.scenarios():
            for s in config.personas()["stores"]:
                add(world.manager_id(sc["key"], s["key"]), prompts.manager(sc["key"], s["key"]),
                    scenario=sc["key"], store=s["key"])
        return lines, keys

    if stage == "barista":
        managers, baristas = _require("barista"), None
    else:
        managers, baristas = load_responses("manager"), _require("customer")

    for sc in world.scenarios():
        key = sc["key"]
        for store_key, barista_key in world.store_baristas():
            decision, _ = resolve_manager(key, store_key, managers)
            if stage == "barista":
                add(world.barista_id(key, store_key, barista_key),
                    prompts.barista(key, store_key, barista_key, decision),
                    scenario=key, store=store_key, barista=barista_key)
                continue
            shift, _ = resolve_shift(key, store_key, barista_key, decision, baristas)
            slots = shift_slots(key, store_key, barista_key, shift["cups"])
            for slot, cup in zip(slots, shift["cups"], strict=True):
                add(world.customer_id(key, store_key, barista_key, slot["slot"]),
                    prompts.customer(key, store_key, slot["customer"], slot["queue"],
                                     slot["wait_min"], cup),
                    scenario=key, store=store_key, barista=barista_key, slot=slot["slot"])
    return lines, keys


def check_schemas() -> None:
    for stage, model in schemas.STAGE_MODELS.items():
        errors = schemas.strict_schema_errors(schemas.json_schema_for(model))
        if errors:
            raise StageError(f"{stage} schema breaks strict mode: {errors}")


def estimate_input_tokens(lines: list[dict]) -> int:
    """chars/4 over the request bodies: a rough proxy, not a tokenizer."""
    return sum(len(json.dumps(line["body"], ensure_ascii=False)) for line in lines) // 4


def build(stage: str) -> dict:
    """Write the requests not yet answered. Answered ids are skipped; errored ids are retried."""
    check_schemas()
    lines, keys = stage_requests(stage, reasoning_fields())
    answered = {cid for cid, row in load_responses(stage).items() if not row.get("error")}
    pending = [line for line in lines if line["custom_id"] not in answered]

    longest = max(len(k["custom_id"]) for k in keys)
    if longest > 64:
        raise StageError(f"custom_id of {longest} chars exceeds the 64 char limit")

    write_jsonl(pending, requests_path(stage))
    write_jsonl(keys, run_dir(stage) / "keys.jsonl")
    cfg = config.model()
    manifest = read_manifest(stage)
    manifest.update({
        "stage": stage,
        "model": cfg["model"],
        "reasoning": lines[0]["body"].get("reasoning_effort") or lines[0]["body"].get("reasoning"),
        "prompt_version": cfg["prompt_version"],
        "endpoint": cfg["endpoint"],
        "status": "built",
        "built_at": now(),
        "counts": {**manifest.get("counts", {}), "total": len(lines), "built": len(pending),
                   "already_answered": len(answered)},
        "est_input_tokens_built": estimate_input_tokens(pending),
    })
    write_manifest(stage, manifest)
    log(stage, f"built {len(pending)} of {len(lines)} requests -> {requests_path(stage)}")
    return manifest


def build_probe(alt: bool = False) -> dict:
    """The first two manager requests. --alt tries reasoning: {effort} instead of reasoning_effort."""
    check_schemas()
    style = "reasoning" if alt else "reasoning_effort"
    lines, keys = stage_requests(PROBE, reasoning_shape(style))
    write_jsonl(lines[:2], requests_path(PROBE))
    write_jsonl(keys[:2], run_dir(PROBE) / "keys.jsonl")
    manifest = {"stage": PROBE, "model": config.model()["model"], "reasoning_param": style,
                "status": "built", "built_at": now(), "counts": {"total": 2, "built": 2}}
    write_manifest(PROBE, manifest)
    log(PROBE, f"built 2 manager requests with {style} -> {requests_path(PROBE)}")
    return manifest


# ---------------------------------------------------------------- submit / poll / download


def client():
    config.load_env()
    if not os.environ.get("OPENAI_API_KEY"):
        raise StageError("OPENAI_API_KEY is not set. Put it in simulation/.env (see .env.example).")
    from openai import OpenAI

    return OpenAI()


def submit(stage: str, force: bool = False) -> str:
    path = requests_path(stage)
    if not path.exists() or not path.read_text(encoding="utf-8").strip():
        raise StageError(f"nothing to submit for {stage}; run build {stage} first")
    manifest = read_manifest(stage)
    if manifest.get("status") not in (None, "built", *TERMINAL, "ingested"):
        raise StageError(f"{stage} batch {manifest['batch_ids'][-1]} is still {manifest['status']}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest in manifest.get("submitted_files", []) and not force:
        raise StageError(f"this exact {path.name} was already submitted; rebuild or pass --force")

    api = client()
    with path.open("rb") as fh:
        uploaded = api.files.create(file=fh, purpose="batch")
    batch = api.batches.create(input_file_id=uploaded.id, endpoint=config.model()["endpoint"],
                               completion_window=config.model()["completion_window"])
    manifest["batch_ids"] = [*manifest.get("batch_ids", []), batch.id]
    manifest["submitted_files"] = [*manifest.get("submitted_files", []), digest]
    manifest["status"] = batch.status
    manifest["submitted_at"] = now()
    write_manifest(stage, manifest)
    log(stage, f"submitted {path.name} as {batch.id} ({batch.status})")
    return batch.id


def poll(stage: str, interval_s: int = 60, once: bool = False) -> str:
    manifest = read_manifest(stage)
    if not manifest.get("batch_ids"):
        raise StageError(f"{stage} has no submitted batch")
    batch_id = manifest["batch_ids"][-1]
    api = client()
    while True:
        batch = api.batches.retrieve(batch_id)
        rc = batch.request_counts
        counts = f"{rc.completed}/{rc.total} done, {rc.failed} failed" if rc else ""
        log(stage, f"{batch_id} {batch.status} {counts}")
        if batch.status in TERMINAL or once:
            break
        time.sleep(max(10, interval_s))
    manifest = read_manifest(stage)
    manifest["status"] = batch.status
    if batch.status in TERMINAL:
        manifest["finished_at"] = now()
    write_manifest(stage, manifest)
    return batch.status


def _parse_line(line: dict, is_error: bool) -> dict:
    """Flatten one batch output line to {custom_id, raw_text, usage, error}."""
    response = line.get("response") or {}
    body = response.get("body") or {}
    error = line.get("error")
    choices = body.get("choices") or []
    raw_text = (choices[0].get("message") or {}).get("content") or "" if choices else ""
    if error is None and (is_error or response.get("status_code", 200) >= 400):
        error = body.get("error") or {"message": "batch error file entry"}
    return {"custom_id": line.get("custom_id", ""), "raw_text": raw_text,
            "usage": body.get("usage") or {}, "error": error}


def download(batch_id: str):
    api = client()
    batch = api.batches.retrieve(batch_id)
    for file_id, is_error in ((batch.output_file_id, False), (batch.error_file_id, True)):
        if file_id:
            for line in api.files.content(file_id).text.splitlines():
                if line.strip():
                    yield _parse_line(json.loads(line), is_error)


# ---------------------------------------------------------------- ingest


def validate(stage: str, raw_text: str) -> tuple[dict | None, str | None]:
    model = schemas.STAGE_MODELS["manager" if stage == PROBE else stage]
    try:
        return model.model_validate_json(raw_text).model_dump(), None
    except ValidationError as exc:
        return None, f"ValidationError: {exc.error_count()} errors: {exc.errors()[0]['msg']}"


def ingest_rows(stage: str, rows, batch_id: str) -> dict:
    """Append results to responses.jsonl. A malformed answer is kept with schema_ok false."""
    have = load_responses(stage)
    out = []
    for result in rows:
        cid = result["custom_id"]
        if cid in have and not have[cid].get("error"):
            continue  # already answered; never overwrite
        parsed, problem = (None, None)
        if result["error"] is None:
            parsed, problem = validate(stage, result["raw_text"])
        out.append({
            "custom_id": cid,
            "raw_text": result["raw_text"],
            "usage": result["usage"],
            "error": result["error"] if result["error"] is not None else problem,
            "schema_ok": parsed is not None,
            "parsed": parsed,
            "batch_id": batch_id,
        })
    write_jsonl(out, run_dir(stage) / "responses.jsonl", mode="a")
    return {"ingested": len(out), "schema_ok": sum(r["schema_ok"] for r in out),
            "failed": sum(not r["schema_ok"] for r in out)}


def update_totals(stage: str) -> dict:
    manifest = read_manifest(stage)
    responses = load_responses(stage)
    usage = [r.get("usage") or {} for r in read_jsonl(run_dir(stage) / "responses.jsonl")]
    tokens = {
        "input": sum(int(u.get("prompt_tokens") or 0) for u in usage),
        "output": sum(int(u.get("completion_tokens") or 0) for u in usage),
    }
    price = config.model()["pricing_usd_per_million"]
    manifest["tokens"] = tokens
    usd = tokens["input"] / 1e6 * price["input"] + tokens["output"] / 1e6 * price["output"]
    manifest["usd"] = round(usd, 4)
    manifest["counts"] = {
        **manifest.get("counts", {}),
        "responses": len(responses),
        "schema_ok": sum(bool(r.get("schema_ok")) for r in responses.values()),
        "schema_failures": sum(not r.get("schema_ok") for r in responses.values()),
    }
    write_manifest(stage, manifest)
    return manifest


def ingest(stage: str) -> dict:
    manifest = read_manifest(stage)
    done = set(manifest.get("ingested_batch_ids", []))
    todo = [b for b in manifest.get("batch_ids", []) if b not in done]
    if not todo:
        raise StageError(f"{stage}: no submitted batch waiting to be ingested")
    if manifest.get("status") not in TERMINAL:
        raise StageError(f"{stage}: batch is {manifest.get('status')}; poll until it finishes")
    for batch_id in todo:
        counts = ingest_rows(stage, download(batch_id), batch_id)
        done.add(batch_id)
        log(stage, f"ingested {batch_id}: {counts}")
    manifest = read_manifest(stage)
    manifest["ingested_batch_ids"] = sorted(done)
    manifest["status"] = "ingested"
    write_manifest(stage, manifest)
    manifest = update_totals(stage)
    if stage == PROBE:
        record_probe(manifest)
    return manifest


def record_probe(manifest: dict) -> None:
    rows = list(load_responses(PROBE).values())
    if rows and all(r["schema_ok"] for r in rows):
        style = manifest["reasoning_param"]
        (run_dir(PROBE) / "works.json").write_text(
            json.dumps({"reasoning_param": style, "recorded_at": now()}, indent=2) + "\n",
            encoding="utf-8")
        log(PROBE, f"probe passed with {style}; later builds use it")
    else:
        log(PROBE, "probe did not pass; read runs/probe/responses.jsonl. If the error names "
                   "reasoning_effort, run: python run.py probe --alt, then submit/poll/ingest probe")


def status() -> None:
    for stage in (PROBE, *STAGES):
        m = read_manifest(stage)
        if not m:
            print(f"{stage:9} not built")
            continue
        c = m.get("counts", {})
        print(f"{stage:9} {m.get('status', '?'):11} built={c.get('built', 0)}/{c.get('total', 0)} "
              f"responses={c.get('responses', 0)} failures={c.get('schema_failures', 0)} "
              f"tokens={m.get('tokens', {})} usd={m.get('usd', 0)} batches={m.get('batch_ids', [])}")


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    sys.exit(1)
