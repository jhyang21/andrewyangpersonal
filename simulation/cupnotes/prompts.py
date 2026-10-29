"""Render system/user messages for each stage from config/prompts/<version>/*.md."""

from __future__ import annotations

from . import config, world


def _fill(template: str, values: dict) -> str:
    for name, value in values.items():
        template = template.replace("{{" + name + "}}", str(value))
    # An empty placeholder (peak_text) can leave trailing spaces behind.
    return "\n".join(line.rstrip() for line in template.splitlines())


def _messages(stage: str, values: dict) -> list[dict]:
    p = config.prompt(stage)
    return [
        {"role": "system", "content": p["system"]},
        {"role": "user", "content": _fill(p["user"], values)},
    ]


def _shared(levers: dict, store: dict) -> dict:
    return {
        "enforcement_policy": config.lever_option("enforcement", levers["enforcement"])["policy_text"],
        "note_policy": config.lever_option("note", levers["note"])["policy_text"],
        "traffic_description": config.lever_option("traffic", levers["traffic"])["description"],
        "staffing_description": config.lever_option("staffing", levers["staffing"])["description"],
        "store_name": store["name"],
        "store_type": store["type_label"],
        "store_setting": store["setting"],
    }


def manager(scenario: str, store_key: str) -> list[dict]:
    store = config.store(store_key)
    m = store["manager"]
    values = _shared(world.scenario_levers(scenario), store) | {
        "manager_name": m["name"],
        "manager_age": m["age"],
        "tenure_text": world.tenure_text(m["tenure_years"]),
        "style_label": m["style_label"],
        "judged_on": m["judged_on"],
        "manager_blurb": m["blurb"],
        "on_initiatives": m["on_initiatives"],
    }
    return _messages("manager", values)


def barista(scenario: str, store_key: str, barista_key: str, decision: dict) -> list[dict]:
    levers = world.scenario_levers(scenario)
    store = config.store(store_key)
    b = config.barista(store_key, barista_key)
    depths = world.queue(levers["traffic"], levers["staffing"], store["traffic_modifier"])
    values = _shared(levers, store) | {
        "manager_name": store["manager"]["name"],
        "style_label": store["manager"]["style_label"],
        "message_to_team": decision["message_to_team"],
        "tracks_text": world.tracks_text(decision["tracks_compliance"]),
        "peak_text": world.peak_text(decision["peak_exception"]),
        "barista_name": b["name"],
        "barista_age": b["age"],
        "tenure": b["tenure"],
        "barista_blurb": b["blurb"],
        "motivation": b["motivation"],
        "stress_tolerance": b["stress_tolerance"],
        "creativity": b["creativity"],
        "on_initiatives": b["on_initiatives"],
        "customer_lines": world.customer_lines(world.seating(store_key, barista_key), depths),
    }
    return _messages("barista", values)


def customer(scenario: str, store_key: str, customer_key: str, queue_depth: int,
             wait_min: float, cup: dict) -> list[dict]:
    levers = world.scenario_levers(scenario)
    store = config.store(store_key)
    c = config.customer(customer_key)
    values = {
        "customer_label": c["label"],
        "cues": c["cues"],
        "private": c["private"],
        "store_name": store["name"],
        "store_type": store["type_label"],
        "traffic_description": config.lever_option("traffic", levers["traffic"])["description"],
        "wait_text": world.wait_text(wait_min),
        "queue": queue_depth,
        "cup_text": world.cup_text(cup["action"], cup["note_text"]),
    }
    return _messages("customer", values)
