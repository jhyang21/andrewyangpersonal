"""Compile stage answers into the page's dataset (SPEC section 7).

Writes content/cup-notes/index.json and public/cup-notes/scenarios/<key>.json.
With fixture=True every answer comes from fake.py and meta.source is "fixture".
"""

from __future__ import annotations

import json
from pathlib import Path

from . import batch, config, world

STANCES = ("enforce_all", "enforce_offpeak", "encourage", "ignore")


def _mean(values) -> float:
    values = list(values)
    return round(sum(values) / len(values), 1) if values else 0.0


def _pct(flags) -> float:
    flags = list(flags)
    return round(100 * sum(bool(f) for f in flags) / len(flags), 1) if flags else 0.0


def outcomes(shifts: list[dict]) -> dict:
    cups = [c for s in shifts for c in s["cups"]]
    reactions = [c["reaction"] for c in cups]
    return {
        "compliance_pct": _pct(c["action"] != "skip" for c in cups),
        "personal_pct": _pct(c["action"] == "personal" for c in cups),
        "skip_pct": _pct(c["action"] == "skip" for c in cups),
        "avg_seconds_added": _mean(c["seconds_added"] for c in cups),
        "avg_wait_min": _mean(c["wait_min"] for c in cups),
        "barista_sentiment": _mean(s["sentiment"] for s in shifts),
        "barista_stress": _mean(s["stress"] for s in shifts),
        "customer_satisfaction": _mean(r["satisfaction"] for r in reactions),
        "connection": _mean(r["connection"] for r in reactions),
        "noticed_pct": _pct(r["noticed"] for r in reactions),
        "delighted_pct": _pct(r["reaction"] == "delighted" for r in reactions),
        "annoyed_pct": _pct(r["reaction"] == "annoyed" for r in reactions),
        "would_mention_pct": _pct(r["would_mention"] for r in reactions),
    }


def scenario_detail(scenario: dict, responses: dict | None) -> dict:
    """One ScenarioDetail. `responses` is {stage: {custom_id: row}}, or None for fixture."""
    key = scenario["key"]
    r = dict.fromkeys(batch.STAGES) if responses is None else responses
    any_fallback = False

    managers = {}
    for s in config.personas()["stores"]:
        decision, fb = batch.resolve_manager(key, s["key"], r["manager"])
        managers[s["key"]] = decision
        any_fallback |= fb

    shifts = []
    for store_key, barista_key in world.store_baristas():
        shift, shift_fb = batch.resolve_shift(key, store_key, barista_key, managers[store_key],
                                              r["barista"])
        cups = []
        slots = batch.shift_slots(key, store_key, barista_key, shift["cups"])
        for slot, cup in zip(slots, shift["cups"], strict=True):
            reaction, fb = batch.resolve_reaction(key, store_key, barista_key, slot, cup, r["customer"])
            any_fallback |= fb
            cups.append({
                "slot": slot["slot"],
                "customer": slot["customer"],
                "queue": slot["queue"],
                "action": cup["action"],
                "note_text": cup["note_text"],
                "seconds_added": cup["seconds_added"],
                "wait_min": slot["wait_min"],
                "reaction": {k: reaction[k] for k in ("noticed", "reaction", "satisfaction", "connection",
                                                      "wait_annoyance", "would_mention", "quote")},
            })
        any_fallback |= shift_fb
        shifts.append({
            "store": store_key,
            "barista": barista_key,
            "stress": shift["stress"],
            "sentiment": shift["sentiment"],
            "quote": shift["quote"],
            "fallback": shift_fb,
            "cups": cups,
        })

    return {
        "key": key,
        "levers": scenario["levers"],
        "outcomes": outcomes(shifts),
        "has_fallback": any_fallback,
        "managers": [{"store": sk, **managers[sk]} for sk in managers],
        "shifts": shifts,
    }


def scenario_summary(detail: dict) -> dict:
    stance_mix = {s: 0 for s in STANCES}
    for m in detail["managers"]:
        stance_mix[m["stance"]] += 1
    by_store = []
    for s in config.personas()["stores"]:
        shifts = [sh for sh in detail["shifts"] if sh["store"] == s["key"]]
        o = outcomes(shifts)
        by_store.append({"store": s["key"], **{k: o[k] for k in (
            "compliance_pct", "avg_wait_min", "customer_satisfaction", "connection", "barista_sentiment")}})
    return {
        "key": detail["key"],
        "levers": detail["levers"],
        "outcomes": detail["outcomes"],
        "stance_mix": stance_mix,
        "by_store": by_store,
        "has_fallback": detail["has_fallback"],
    }


def _population() -> dict:
    p = config.personas()
    lv = config.levers()
    return {
        "levers": {name: [{"key": o["key"], "label": o["label"], "short": o["short"]} for o in lv[name]]
                   for name in ("enforcement", "note", "traffic", "staffing")},
        "stores": [{
            "key": s["key"],
            "name": s["name"],
            "type_label": s["type_label"],
            "setting": s["setting"],
            "manager": {k: s["manager"][k] for k in
                        ("name", "style", "style_label", "tenure_years", "judged_on", "blurb")},
            "baristas": [{k: b[k] for k in ("key", "name", "tenure", "blurb")} for b in s["baristas"]],
        } for s in p["stores"]],
        "customers": [{k: c[k] for k in ("key", "label", "blurb")} for c in p["customers"]],
    }


def _meta(fixture: bool, n_scenarios: int, schema_failures: int) -> dict:
    cfg = config.model()
    manifests = {} if fixture else {st: batch.read_manifest(st) for st in batch.STAGES}
    n_stores = len(config.personas()["stores"])
    n_baristas = len(world.store_baristas())
    return {
        "source": "fixture" if fixture else "openai-batch",
        "model": cfg["model"],
        "reasoning_effort": cfg["reasoning_effort"],
        "prompt_version": cfg["prompt_version"],
        "generated_at": batch.now(),
        "counts": {
            "scenarios": n_scenarios,
            "manager_calls": n_scenarios * n_stores,
            "barista_calls": n_scenarios * n_baristas,
            "customer_calls": n_scenarios * n_baristas * world.SLOTS,
        },
        "tokens": {
            "input": sum(m.get("tokens", {}).get("input", 0) for m in manifests.values()),
            "output": sum(m.get("tokens", {}).get("output", 0) for m in manifests.values()),
        },
        "usd": round(sum(m.get("usd", 0) for m in manifests.values()), 2),
        "batch_ids": [b for m in manifests.values() for b in m.get("batch_ids", [])],
        "schema_failures": schema_failures,
        "disclaimer": config.DISCLAIMER,
    }


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def run(fixture: bool = False) -> dict:
    responses = None
    schema_failures = 0
    if not fixture:
        responses = {}
        for stage in batch.STAGES:
            keys = [k["custom_id"] for k in batch.read_jsonl(batch.run_dir(stage) / "keys.jsonl")]
            rows = batch.load_responses(stage)
            if not keys or not rows:
                raise batch.StageError(f"compile needs ingested {stage} responses; or use --fixture")
            responses[stage] = rows
            # A missing answer is a failure too: compile fills it from the fixture backend.
            schema_failures += sum(1 for k in keys if not rows.get(k, {}).get("schema_ok"))

    scenarios = world.scenarios()
    details = [scenario_detail(sc, responses) for sc in scenarios]
    meta = _meta(fixture, len(scenarios), schema_failures)
    index = {"meta": meta, **_population(), "scenarios": [scenario_summary(d) for d in details]}

    _write(config.INDEX_PATH, index)
    for d in details:
        _write(config.SCENARIO_DIR / f"{d['key']}.json", d)
    fallbacks = sum(d["has_fallback"] for d in details)
    print(f"compiled {len(details)} scenarios ({meta['source']}); {fallbacks} with fallback; "
          f"{schema_failures} failed answers -> {config.INDEX_PATH} and {config.SCENARIO_DIR}")
    return index
