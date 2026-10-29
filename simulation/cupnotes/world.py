"""Deterministic world rules (SPEC section 4). Pure functions, no I/O beyond config."""

from __future__ import annotations

import itertools
import random

from . import config

BASE_QUEUE = {
    "steady": [2, 3, 3, 4, 3, 2, 2, 1],
    "rush": [4, 8, 11, 12, 9, 6, 4, 3],
}
SLOTS = 8

CUP_TEXT = {
    "skip": "There is nothing on your cup but your name.",
    "smiley": "The barista drew a quick smiley on your cup.",
    "generic": 'The barista wrote on your cup: "{note_text}"',
    "personal": 'The barista wrote on your cup: "{note_text}"',
}


def rng(*parts: object) -> random.Random:
    """A Random seeded by a string that names the entity, so call order never matters."""
    return random.Random("|".join([str(config.seed()), *map(str, parts)]))


def scenarios() -> list[dict]:
    """All 24 scenarios as {key, levers}, in itertools.product order over levers.json."""
    lv = config.levers()
    names = ["enforcement", "note", "traffic", "staffing"]
    out = []
    for combo in itertools.product(*[[o["key"] for o in lv[n]] for n in names]):
        chosen = dict(zip(names, combo, strict=True))
        out.append({"key": "-".join(combo), "levers": chosen})
    return out


def scenario_levers(key: str) -> dict:
    return next(s["levers"] for s in scenarios() if s["key"] == key)


def store_baristas() -> list[tuple[str, str]]:
    """(store_key, barista_key) pairs in personas.json order."""
    return [(s["key"], b["key"]) for s in config.personas()["stores"] for b in s["baristas"]]


def seating(store_key: str, barista_key: str) -> list[str]:
    """The 8 customer archetype keys this barista serves, in slot order."""
    keys = [c["key"] for c in config.personas()["customers"]]
    rng("seat", store_key, barista_key).shuffle(keys)
    return keys


def queue(traffic: str, staffing: str, traffic_modifier: int) -> list[int]:
    extra = 2 if staffing == "short" else 0
    return [max(1, min(15, b + traffic_modifier + extra)) for b in BASE_QUEUE[traffic]]


def service_seconds(staffing: str) -> int:
    return 65 if staffing == "short" else 50


def waits(queue_depths: list[int], seconds_added: list[int], staffing: str) -> list[float]:
    """wait_min per slot. The running mean includes the current cup."""
    service = service_seconds(staffing)
    out = []
    for i, depth in enumerate(queue_depths):
        running_mean = sum(seconds_added[: i + 1]) / (i + 1)
        out.append(round(depth * (service + running_mean) / 60, 1))
    return out


def wait_text(wait_min: float) -> str:
    n = max(1, round(wait_min))
    return "a minute" if n == 1 else f"{n} minutes"


def cup_text(action: str, note_text: str | None) -> str:
    return CUP_TEXT[action].replace("{note_text}", note_text or "")


def tenure_text(tenure_years: float) -> str:
    return "four months" if tenure_years < 1 else f"{tenure_years:g} years"


def tracks_text(tracks_compliance: bool) -> str:
    return "will be checking cups today" if tracks_compliance else "is not checking cups today"


def peak_text(peak_exception: bool) -> str:
    return "Your manager said partners may skip the note during a rush." if peak_exception else ""


def customer_lines(customer_keys: list[str], queue_depths: list[int]) -> str:
    lines = []
    for i, (key, depth) in enumerate(zip(customer_keys, queue_depths, strict=True)):
        c = config.customer(key)
        lines.append(f"{i + 1}. ({depth} waiting) {c['label']}: {c['cues']}")
    return "\n".join(lines)


def manager_id(scenario: str, store_key: str) -> str:
    return f"m|{scenario}|{store_key}"


def barista_id(scenario: str, store_key: str, barista_key: str) -> str:
    return f"b|{scenario}|{store_key}|{barista_key}"


def customer_id(scenario: str, store_key: str, barista_key: str, slot: int) -> str:
    return f"c|{scenario}|{store_key}|{barista_key}|{slot}"
