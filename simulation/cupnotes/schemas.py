"""Stage outputs (SPEC section 5) as pydantic models, plus the strict JSON schemas sent to OpenAI.

String length limits are not sent in the schema: OpenAI strict mode does not list maxLength
among its supported keywords. The prompts state the limits and ingest truncates instead.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator


def _cut(limit: int):
    def cut(value):
        return value[:limit] if isinstance(value, str) else value

    return BeforeValidator(cut)


Score = Annotated[int, Field(ge=0, le=100)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ManagerDecision(_Strict):
    stance: Literal["enforce_all", "enforce_offpeak", "encourage", "ignore"]
    intensity: Score
    tracks_compliance: bool
    peak_exception: bool
    message_to_team: Annotated[str, _cut(320)]
    private_thought: Annotated[str, _cut(200)]
    expected_friction: Score


class CupDecision(_Strict):
    action: Literal["skip", "smiley", "generic", "personal"]
    note_text: Annotated[str | None, _cut(40)]
    seconds_added: Annotated[int, Field(ge=0, le=45)]

    @model_validator(mode="after")
    def _note_iff_not_skip(self):
        # SPEC: note_text is null iff action == skip; coerce, do not fail.
        text = (self.note_text or "").strip()
        if self.action == "skip":
            self.note_text = None
        elif not text:
            if self.action == "smiley":
                self.note_text = ":)"
            else:
                # A written note with no words on it is a cup with nothing on it.
                self.action = "skip"
                self.note_text = None
        else:
            self.note_text = text
        return self


class BaristaShift(_Strict):
    cups: Annotated[list[CupDecision], Field(min_length=8, max_length=8)]
    stress: Score
    sentiment: Score
    quote: Annotated[str, _cut(320)]


class CustomerReaction(_Strict):
    noticed: bool
    reaction: Literal["delighted", "warm", "neutral", "indifferent", "annoyed"]
    satisfaction: Score
    connection: Score
    wait_annoyance: Score
    would_mention: bool
    quote: Annotated[str, _cut(240)]


STAGE_MODELS: dict[str, type[BaseModel]] = {
    "manager": ManagerDecision,
    "barista": BaristaShift,
    "customer": CustomerReaction,
}

_DROP = {"title", "default", "description", "$defs"}


def _clean(node, defs: dict):
    """Inline $refs, drop titles/defaults, turn anyOf[X, null] into a type array."""
    if isinstance(node, list):
        return [_clean(n, defs) for n in node]
    if not isinstance(node, dict):
        return node
    if "$ref" in node:
        return _clean(defs[node["$ref"].split("/")[-1]], defs)
    if "anyOf" in node:
        options = [_clean(o, defs) for o in node["anyOf"]]
        types = [o.get("type") for o in options]
        if len(options) == 2 and "null" in types:
            other = options[types.index("null") ^ 1]
            return {**other, "type": [other["type"], "null"]}
        return {"anyOf": options}
    # Property names are not schema keywords, so a field called "title" must survive the drop.
    out = {k: ({pk: _clean(pv, defs) for pk, pv in v.items()} if k == "properties" else _clean(v, defs))
           for k, v in node.items() if k not in _DROP}
    if out.get("type") == "object":
        out["required"] = list(out.get("properties", {}))
        out["additionalProperties"] = False
    return out


def json_schema_for(model: type[BaseModel]) -> dict:
    raw = model.model_json_schema()
    return _clean(raw, raw.get("$defs", {}))


def response_format(stage: str) -> dict:
    model = STAGE_MODELS[stage]
    return {
        "type": "json_schema",
        "json_schema": {"name": model.__name__, "strict": True, "schema": json_schema_for(model)},
    }


def strict_schema_errors(schema: dict, path: str = "schema") -> list[str]:
    """Where a schema breaks OpenAI strict mode. The API reports only the first breach,
    and only after a batch round trip, so check the whole tree before submitting."""
    errors: list[str] = []
    if not isinstance(schema, dict):
        return errors
    if "$ref" in schema or "$defs" in schema:
        errors.append(f"{path}: unresolved $ref/$defs")
    if schema.get("type") == "object":
        properties = schema.get("properties") or {}
        if schema.get("additionalProperties") is not False:
            errors.append(f"{path}: needs additionalProperties: false")
        missing = sorted(set(properties) - set(schema.get("required") or []))
        if missing:
            errors.append(f"{path}: required must name every property; missing {missing}")
        for name, child in properties.items():
            errors += strict_schema_errors(child, f"{path}.properties.{name}")
    if isinstance(schema.get("items"), dict):
        errors += strict_schema_errors(schema["items"], f"{path}.items")
    for i, option in enumerate(schema.get("anyOf") or []):
        errors += strict_schema_errors(option, f"{path}.anyOf[{i}]")
    return errors
