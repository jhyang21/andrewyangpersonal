import itertools
import json

import pytest

from cupnotes import batch, compile, config, fake, prompts, schemas, world


@pytest.fixture
def tmp_outputs(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RUNS_DIR", tmp_path / "runs")
    monkeypatch.setattr(config, "INDEX_PATH", tmp_path / "content" / "index.json")
    monkeypatch.setattr(config, "SCENARIO_DIR", tmp_path / "public" / "scenarios")
    return tmp_path


# ---------------------------------------------------------------- world


def test_scenarios_are_24_in_product_order():
    keys = [s["key"] for s in world.scenarios()]
    lv = config.levers()
    expected = ["-".join(c) for c in itertools.product(
        *[[o["key"] for o in lv[n]] for n in ("enforcement", "note", "traffic", "staffing")])]
    assert keys == expected
    assert len(keys) == 24 and keys[0] == "strict-mark-steady-full"


def test_seating_is_deterministic_and_complete():
    customers = sorted(c["key"] for c in config.personas()["customers"])
    for store_key, barista_key in world.store_baristas():
        seats = world.seating(store_key, barista_key)
        assert seats == world.seating(store_key, barista_key)
        assert sorted(seats) == customers


def test_seating_uses_the_spec_seed_string():
    import random

    keys = [c["key"] for c in config.personas()["customers"]]
    random.Random(f"{config.seed()}|seat|campus|sofia").shuffle(keys)
    assert world.seating("campus", "sofia") == keys


def test_queue_clamps_and_short_staffing():
    assert world.queue("steady", "full", 0) == [2, 3, 3, 4, 3, 2, 2, 1]
    assert world.queue("rush", "short", 2) == [8, 12, 15, 15, 13, 10, 8, 7]
    assert world.queue("steady", "full", -1)[-1] == 1


def test_longest_custom_id_fits():
    ids = [world.customer_id(s["key"], sk, bk, 7)
           for s in world.scenarios() for sk, bk in world.store_baristas()]
    assert max(map(len, ids)) <= 64


def test_wait_formula_hand_example():
    # short staffing: 65 s service. running means: 6, 3, 12.
    # 4 * 71 / 60 = 4.733; 8 * 68 / 60 = 9.067; 11 * 77 / 60 = 14.117
    assert world.waits([4, 8, 11], [6, 0, 30], "short") == [4.7, 9.1, 14.1]
    assert world.waits([2], [0], "full") == [1.7]  # 2 * 50 / 60
    assert world.wait_text(4.7) == "5 minutes"
    assert world.wait_text(0.4) == "a minute"
    assert world.wait_text(1.4) == "a minute"


def test_text_helpers():
    assert world.tenure_text(0.3) == "four months"
    assert world.tenure_text(9) == "9 years"
    assert world.cup_text("smiley", ":)") == "The barista drew a quick smiley on your cup."
    assert world.cup_text("generic", "Enjoy!") == 'The barista wrote on your cup: "Enjoy!"'


# ---------------------------------------------------------------- schemas


@pytest.mark.parametrize("stage", list(schemas.STAGE_MODELS))
def test_strict_schema_guard_passes(stage):
    schema = schemas.json_schema_for(schemas.STAGE_MODELS[stage])
    assert schemas.strict_schema_errors(schema) == []


def test_strict_schema_guard_catches_breaches():
    bad = {"type": "object", "properties": {"a": {"type": "string"}}}
    assert len(schemas.strict_schema_errors(bad)) == 2


def test_cup_coercion():
    c = schemas.CupDecision.model_validate({"action": "skip", "note_text": "hi", "seconds_added": 0})
    assert c.note_text is None
    c = schemas.CupDecision.model_validate({"action": "generic", "note_text": None, "seconds_added": 5})
    assert (c.action, c.note_text) == ("skip", None)
    c = schemas.CupDecision.model_validate({"action": "smiley", "note_text": "", "seconds_added": 3})
    assert c.note_text == ":)"
    c = schemas.CupDecision.model_validate({"action": "personal", "note_text": "x" * 60, "seconds_added": 20})
    assert len(c.note_text) == 40


# ---------------------------------------------------------------- prompts


def test_prompts_leave_no_placeholders():
    sc = "adaptive-personal-rush-short"
    decision = fake.manager(sc, "airport")
    shift = fake.shift(sc, "airport", "grace", decision)
    slot = batch.shift_slots(sc, "airport", "grace", shift["cups"])[3]
    rendered = (prompts.manager(sc, "airport")
                + prompts.barista(sc, "airport", "grace", decision)
                + prompts.customer(sc, "airport", slot["customer"], slot["queue"], slot["wait_min"],
                                   shift["cups"][3]))
    for message in rendered:
        assert "{{" not in message["content"] and "}}" not in message["content"]
        assert message["content"].strip()


# ---------------------------------------------------------------- fixture compile

INDEX_KEYS = ["meta", "levers", "stores", "customers", "scenarios"]
META_KEYS = ["source", "model", "reasoning_effort", "prompt_version", "generated_at", "counts",
             "tokens", "usd", "batch_ids", "schema_failures", "disclaimer"]
OUTCOME_KEYS = ["compliance_pct", "personal_pct", "skip_pct", "avg_seconds_added", "avg_wait_min",
                "barista_sentiment", "barista_stress", "customer_satisfaction", "connection",
                "noticed_pct", "delighted_pct", "annoyed_pct", "would_mention_pct"]


def test_fixture_compile(tmp_outputs):
    compile.run(fixture=True)
    index = json.loads(config.INDEX_PATH.read_text(encoding="utf-8"))
    assert list(index) == INDEX_KEYS
    assert list(index["meta"]) == META_KEYS
    assert index["meta"]["source"] == "fixture" and index["meta"]["batch_ids"] == []
    assert len(index["scenarios"]) == 24
    assert list(index["levers"]["enforcement"][0]) == ["key", "label", "short"]

    files = sorted(config.SCENARIO_DIR.glob("*.json"))
    assert len(files) == 24
    for summary in index["scenarios"]:
        assert list(summary["outcomes"]) == OUTCOME_KEYS
        assert sum(summary["stance_mix"].values()) == 6
        assert len(summary["by_store"]) == 6
        detail = json.loads((config.SCENARIO_DIR / f"{summary['key']}.json").read_text(encoding="utf-8"))
        assert detail["outcomes"] == summary["outcomes"]
        assert len(detail["managers"]) == 6 and len(detail["shifts"]) == 12
        cups = [c for s in detail["shifts"] for c in s["cups"]]
        assert len(cups) == 96
        for c in cups:
            schemas.CupDecision.model_validate({k: c[k] for k in ("action", "note_text", "seconds_added")})
            schemas.CustomerReaction.model_validate(c["reaction"])
            assert (c["note_text"] is None) == (c["action"] == "skip")


def test_fixture_is_deterministic(tmp_outputs):
    compile.run(fixture=True)
    first = (config.SCENARIO_DIR / "strict-mark-rush-short.json").read_text(encoding="utf-8")
    compile.run(fixture=True)
    assert (config.SCENARIO_DIR / "strict-mark-rush-short.json").read_text(encoding="utf-8") == first


def test_fixture_moves_with_levers(tmp_outputs):
    index = compile.run(fixture=True)
    o = {s["key"]: s["outcomes"] for s in index["scenarios"]}
    calm, slammed = o["strict-mark-steady-full"], o["strict-mark-rush-short"]
    assert calm["compliance_pct"] > slammed["compliance_pct"]
    assert slammed["barista_stress"] > calm["barista_stress"]
    assert calm["compliance_pct"] > o["flexible-mark-steady-full"]["compliance_pct"]


# ---------------------------------------------------------------- batch round trip, offline


def _answers(stage: str, mutate=None):
    """Fake batch results for every built request of a stage, as download() would yield them."""
    keys = batch.read_jsonl(batch.run_dir(stage) / "keys.jsonl")
    managers = batch.load_responses("manager")
    baristas = batch.load_responses("barista")
    for k in keys:
        if stage == "manager":
            answer = fake.manager(k["scenario"], k["store"])
        else:
            decision, _ = batch.resolve_manager(k["scenario"], k["store"], managers)
            if stage == "barista":
                answer = fake.shift(k["scenario"], k["store"], k["barista"], decision)
            else:
                shift, _ = batch.resolve_shift(k["scenario"], k["store"], k["barista"], decision, baristas)
                cups = shift["cups"]
                slot = batch.shift_slots(k["scenario"], k["store"], k["barista"], cups)[k["slot"]]
                answer = fake.reaction(k["scenario"], k["store"], k["barista"], k["slot"],
                                       slot["customer"], cups[k["slot"]], slot["queue"], slot["wait_min"])
        if mutate:
            answer = mutate(k["custom_id"], answer)
        yield {"custom_id": k["custom_id"], "raw_text": json.dumps(answer),
               "usage": {"prompt_tokens": 1000, "completion_tokens": 200}, "error": None}


BROKEN_SHIFT = "b|strict-mark-steady-full|campus|noah"


def _drop_a_cup(custom_id, answer):
    if custom_id == BROKEN_SHIFT:
        answer = {**answer, "cups": answer["cups"][:7]}
    return answer


def test_offline_round_trip(tmp_outputs):
    with pytest.raises(batch.StageError):
        batch.build("barista")

    assert batch.build("manager")["counts"]["built"] == 144
    batch.ingest_rows("manager", _answers("manager"), "batch_m")
    assert batch.build("manager")["counts"]["built"] == 0  # resume: everything answered

    assert batch.build("barista")["counts"]["built"] == 288
    counts = batch.ingest_rows("barista", _answers("barista", _drop_a_cup), "batch_b")
    assert counts == {"ingested": 288, "schema_ok": 287, "failed": 1}
    assert batch.load_responses("barista")[BROKEN_SHIFT]["schema_ok"] is False

    manifest = batch.build("customer")
    assert manifest["counts"]["built"] == 2304
    batch.ingest_rows("customer", _answers("customer"), "batch_c")
    totals = batch.update_totals("customer")
    assert totals["tokens"] == {"input": 2304000, "output": 460800}
    assert totals["usd"] == pytest.approx(2.304 * 0.05 + 0.4608 * 0.25)

    index = compile.run(fixture=False)
    assert index["meta"]["source"] == "openai-batch"
    assert index["meta"]["schema_failures"] == 1
    flagged = [s["key"] for s in index["scenarios"] if s["has_fallback"]]
    assert flagged == ["strict-mark-steady-full"]
    detail = json.loads((config.SCENARIO_DIR / "strict-mark-steady-full.json").read_text(encoding="utf-8"))
    fell_back = [(s["store"], s["barista"]) for s in detail["shifts"] if s["fallback"]]
    assert fell_back == [("campus", "noah")]


def test_request_line_shape(tmp_outputs):
    batch.build_probe()
    lines = batch.read_jsonl(batch.requests_path("probe"))
    assert len(lines) == 2
    line = lines[0]
    assert set(line) == {"custom_id", "method", "url", "body"}
    body = line["body"]
    assert body["reasoning_effort"] == "low" and "temperature" not in body
    assert body["response_format"]["json_schema"]["strict"] is True
    assert body["max_completion_tokens"] == 1200  # manager cap, config/model.json
    batch.build_probe(alt=True)
    alt = batch.read_jsonl(batch.requests_path("probe"))[0]["body"]
    assert alt["reasoning"] == {"effort": "low"} and "reasoning_effort" not in alt


def test_error_line_is_kept_and_retried(tmp_outputs):
    batch.build("manager")
    rows = list(_answers("manager"))
    rows[0] = {**rows[0], "raw_text": "", "error": {"code": "batch_expired"}}
    batch.ingest_rows("manager", rows, "batch_m")
    assert batch.build("manager")["counts"]["built"] == 1
    batch.ingest_rows("manager", [list(_answers("manager"))[0]], "batch_m2")
    assert batch.load_responses("manager")[rows[0]["custom_id"]]["schema_ok"] is True
    assert len(batch.read_jsonl(batch.run_dir("manager") / "responses.jsonl")) == 145  # nothing dropped
