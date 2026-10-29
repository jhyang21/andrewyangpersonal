"""Rule-based fixture answers (SPEC section 8). Deterministic, lever-sensitive, no network.

Used for `compile --fixture`, and to fill any answer the model got wrong or never gave.
Every function returns a dict that validates against the matching model in schemas.py.
"""

from __future__ import annotations

from . import config, world


def _clamp(x: float) -> int:
    return max(0, min(100, round(x)))


# ---------------------------------------------------------------- manager

ENFORCEMENT_BASE = {"strict": 75, "adaptive": 55, "flexible": 35}
STYLE_PULL = {
    "by-the-book": 20,
    "new-and-anxious": 15,
    "numbers-driven": -5,
    "people-first": -10,
    "hands-off": -30,
    "veteran-pragmatic": -15,
}
RUSH_AVERSE = {"numbers-driven", "veteran-pragmatic"}

HUDDLE = {
    "enforce_all": [
        "Notes on every cup today, no exceptions. I'll be checking the handoff plane.",
        "Corporate wants a note on every cup, so that's what we do. I'll look at cups all shift.",
        "Every cup gets a note. If you fall behind, tell me, but don't skip it.",
    ],
    "enforce_offpeak": [
        "Notes on every cup while the line is short. When it backs up, drinks first.",
        "Write the notes when we're slow. In the rush, just get drinks out.",
        "Off-peak, every cup. If six or more are waiting, skip it and keep moving.",
    ],
    "encourage": [
        "There's a new thing about notes on cups. Do it when you can, have fun with it.",
        "If you've got a second, write something on the cup. Nobody's counting.",
        "Try the cup notes when it feels right. I'd rather they mean something.",
    ],
    "ignore": [
        "Let's just keep the line moving today.",
        "Same as always, folks. Speed and accuracy.",
        "Nothing new from me. Let's have a clean shift.",
    ],
}
THOUGHT = {
    "by-the-book": ["If it's in the memo, it's in the audit.", "Rules keep the arguments short."],
    "numbers-driven": ["Six seconds a cup is real labor at our volume.", "Show me what this moves."],
    "people-first": ["I won't let a memo make my team miserable.", "This works only if they want to."],
    "hands-off": ["This one will be gone by spring.", "Nobody is going to check a mall kiosk."],
    "new-and-anxious": ["If I get this wrong, it's on me either way.", "I hope they don't push back."],
    "veteran-pragmatic": [
        "Anything that slows the line is a complaint later.",
        "Corporate never worked Gate 20.",
    ],
}


def manager(scenario: str, store_key: str) -> dict:
    lv = world.scenario_levers(scenario)
    m = config.store(store_key)["manager"]
    r = world.rng("fake", "manager", scenario, store_key)
    rush, short = lv["traffic"] == "rush", lv["staffing"] == "short"

    score = ENFORCEMENT_BASE[lv["enforcement"]] + STYLE_PULL[m["style"]]
    if rush:
        score -= 20 if m["style"] in RUSH_AVERSE else 8
    if short:
        score -= 8
    score += r.randint(-8, 8)

    if score >= 70:
        stance = "enforce_all"
    elif score >= 50 or (lv["enforcement"] == "adaptive" and score >= 40):
        stance = "enforce_offpeak"
    elif score >= 22:
        stance = "encourage"
    else:
        stance = "ignore"

    tracks = stance == "enforce_all" or (stance == "enforce_offpeak" and lv["enforcement"] != "flexible")
    peak = stance == "enforce_offpeak" or (rush and stance == "encourage")
    friction = 20 + 25 * rush + 20 * short + (15 if stance == "enforce_all" else 0)
    friction += 10 if lv["note"] == "personal" else 0
    return {
        "stance": stance,
        "intensity": _clamp(score),
        "tracks_compliance": tracks,
        "peak_exception": peak,
        "message_to_team": r.choice(HUDDLE[stance]),
        "private_thought": r.choice(THOUGHT[m["style"]]),
        "expected_friction": _clamp(friction + r.randint(-6, 6)),
    }


# ---------------------------------------------------------------- barista

LEVEL = {"low": -1, "medium": 0, "high": 1}
ATTITUDE = {"keen": 0.15, "neutral": 0.0, "skeptical": -0.15}
QUEUE_DRAG = {"low": 0.045, "medium": 0.03, "high": 0.018}

SMILEYS = [":)", "<3", "*", ":D"]
GENERIC = ["Enjoy!", "Have a great day", "Thank you!", "You got this!", "Enjoy your day :)"]
PERSONAL = {
    "commuter": ["Make that train!", "Run, you've got this", "Hope you beat the clock"],
    "regular": ["Hi again! How was the weekend?", "The usual, made with love", "See you tomorrow!"],
    "mobile": ["Fresh off the shelf for you", "Ready on time, enjoy", "Hope the desk is kind today"],
    "tourist": ["Welcome to town!", "Your first grande! Enjoy", "Have a great trip!"],
    "parent": ["For the little one: you rock!", "Hot cocoa for the boss", "Hang in there, parent!"],
    "student": ["Good luck with the paper", "Three hours of focus, go", "You'll ace it"],
    "skeptic": ["Plain drip, no fuss", "Black, like you like it", "Quiet cup for you"],
    "elder": ["Lovely to see you again", "Thank you for asking, friend", "Enjoy, see you Thursday"],
}
SECONDS = {"smiley": (2, 4), "generic": (5, 8), "personal": (12, 25)}

SHIFT_QUOTE = {
    ("keen", False): [
        "Honestly the notes were the best part of today. People smiled.",
        "I got to draw on almost every cup. That's a good shift.",
    ],
    ("keen", True): [
        "I wanted to do them all, but the line ate me alive.",
        "I started strong and then it got too busy to think.",
    ],
    ("neutral", False): [
        "The notes were fine. Not a big deal when it's quiet.",
        "Did what was asked. It's easier when it's slow.",
    ],
    ("neutral", True): [
        "Notes in a rush? Pick one: notes or drinks.",
        "I did some. Then the line got long and I stopped.",
    ],
    ("skeptical", False): [
        "Same pay, more writing. But sure, it was quiet.",
        "Wrote what I had to. Nobody reads them anyway.",
    ],
    ("skeptical", True): [
        "Whoever wrote this memo has never worked a rush.",
        "Twelve people waiting and they want a poem on the cup.",
    ],
}


def _choose_mark(r, b: dict, note: str, customer: str, depth: int) -> str:
    creative = LEVEL[b["creativity"]]
    personal_odds = 0.15 + 0.2 * creative + (0.35 if note == "personal" else 0.0)
    personal_odds += 0.15 if customer in ("regular", "elder", "parent") else 0.0
    personal_odds -= 0.03 * depth
    if r.random() < personal_odds:
        return "personal"
    if note == "personal":
        # Under the personal rule a smiley does not count, so a stock phrase is the usual fallback.
        return "generic" if r.random() < 0.8 else "smiley"
    return "smiley" if r.random() < 0.55 - 0.15 * creative else "generic"


def _note_text(r, action: str, customer: str) -> str:
    if action == "smiley":
        return r.choice(SMILEYS)
    if action == "generic":
        return r.choice(GENERIC)
    return r.choice(PERSONAL[customer])


def shift(scenario: str, store_key: str, barista_key: str, decision: dict) -> dict:
    lv = world.scenario_levers(scenario)
    store = config.store(store_key)
    b = config.barista(store_key, barista_key)
    r = world.rng("fake", "barista", scenario, store_key, barista_key)
    rush, short = lv["traffic"] == "rush", lv["staffing"] == "short"
    depths = world.queue(lv["traffic"], lv["staffing"], store["traffic_modifier"])
    seats = world.seating(store_key, barista_key)

    base = 0.35 + 0.15 * LEVEL[b["motivation"]] + ATTITUDE[b["on_initiatives"]]
    base += decision["intensity"] / 300 + (0.15 if decision["tracks_compliance"] else 0.0)
    base -= 0.1 if short else 0.0

    cups = []
    for customer, depth in zip(seats, depths, strict=True):
        p = base - QUEUE_DRAG[b["stress_tolerance"]] * depth
        if decision["peak_exception"] and depth >= 6:
            p -= 0.3
        if r.random() >= p:
            cups.append({"action": "skip", "note_text": None, "seconds_added": 0})
            continue
        action = _choose_mark(r, b, lv["note"], customer, depth)
        lo, hi = SECONDS[action]
        seconds = r.randint(lo, hi)
        if action == "personal" and LEVEL[b["creativity"]] > 0:
            seconds += 6
        cups.append({"action": action, "note_text": _note_text(r, action, customer),
                     "seconds_added": min(45, seconds)})

    marks = sum(c["action"] != "skip" for c in cups)
    stress = 25 + 25 * rush + 15 * short - 12 * LEVEL[b["stress_tolerance"]]
    stress += 2 * marks + (8 if decision["tracks_compliance"] else 0) + r.randint(-5, 5)
    sentiment = 62 + 8 * LEVEL[b["motivation"]] + 40 * ATTITUDE[b["on_initiatives"]] - 0.25 * stress
    if b["on_initiatives"] == "skeptical" and decision["stance"] == "enforce_all":
        sentiment -= 10
    if b["on_initiatives"] == "keen" and decision["stance"] in ("encourage", "enforce_offpeak"):
        sentiment += 6
    sentiment += r.randint(-5, 5)
    return {
        "cups": cups,
        "stress": _clamp(stress),
        "sentiment": _clamp(sentiment),
        "quote": r.choice(SHIFT_QUOTE[(b["on_initiatives"], rush or short)]),
    }


# ---------------------------------------------------------------- customer

# How readily each archetype looks at the cup, and how much each minute of wait hurts.
NOTICE = {"commuter": 0.25, "regular": 0.95, "mobile": 0.45, "tourist": 0.9,
          "parent": 0.35, "student": 0.6, "skeptic": 0.7, "elder": 0.95}
IMPATIENCE = {"commuter": 14, "regular": 5, "mobile": 11, "tourist": 3,
              "parent": 12, "student": 3, "skeptic": 10, "elder": 2}

REACTION = {
    "commuter": {"skip": "neutral", "smiley": "indifferent", "generic": "indifferent", "personal": "warm"},
    "regular": {"skip": "neutral", "smiley": "warm", "generic": "warm", "personal": "delighted"},
    "mobile": {"skip": "indifferent", "smiley": "warm", "generic": "neutral", "personal": "warm"},
    "tourist": {"skip": "neutral", "smiley": "warm", "generic": "delighted", "personal": "delighted"},
    "parent": {"skip": "neutral", "smiley": "neutral", "generic": "neutral", "personal": "delighted"},
    "student": {"skip": "indifferent", "smiley": "indifferent", "generic": "indifferent", "personal": "warm"},
    "skeptic": {"skip": "neutral", "smiley": "annoyed", "generic": "annoyed", "personal": "warm"},
    "elder": {"skip": "neutral", "smiley": "warm", "generic": "warm", "personal": "delighted"},
}
SATISFACTION = {"delighted": 90, "warm": 78, "neutral": 64, "indifferent": 58, "annoyed": 35}
CONNECTION = {"skip": 25, "smiley": 45, "generic": 40, "personal": 80}

CUSTOMER_QUOTE = {
    "delighted": [
        "That little note just made my morning.",
        "I'm keeping this cup. Someone actually paid attention.",
        "Taking a photo of this before I drink it.",
    ],
    "warm": [
        "Nice touch. Didn't expect that.",
        "Kind of sweet, honestly.",
        "Good coffee, and somebody was paying attention.",
    ],
    "neutral": [
        "Coffee's fine. On to the day.",
        "Got what I ordered. That's all I need.",
        "Normal visit. Nothing to report.",
    ],
    "indifferent": [
        "Didn't really look at the cup.",
        "Whatever's on there, I'm just here for caffeine.",
        "It's a cup. It holds coffee.",
    ],
    "annoyed": [
        "I waited longer so somebody could doodle on my cup?",
        "Skip the art and just make the coffee faster.",
        "That took way too long for a plain coffee.",
    ],
}


def reaction(scenario: str, store_key: str, barista_key: str, slot: int, customer: str,
             cup: dict, queue_depth: int, wait_min: float) -> dict:
    r = world.rng("fake", "customer", scenario, store_key, barista_key, slot)
    action = cup["action"]
    noticed = r.random() < NOTICE[customer] + (0.2 if action == "personal" else 0.0)
    wait_annoyance = _clamp(IMPATIENCE[customer] * wait_min - 5 + r.randint(-6, 6))

    mood = REACTION[customer][action] if noticed else "indifferent"
    if customer == "skeptic" and mood == "annoyed" and wait_min < 3:
        mood = "indifferent"  # a decorated cup only grates when it cost him time
    if wait_annoyance >= 70:
        mood = "annoyed"
    if not noticed and wait_annoyance < 25 and customer in ("regular", "elder"):
        mood = "neutral"

    satisfaction = SATISFACTION[mood] - 0.3 * wait_annoyance + r.randint(-5, 5)
    connection = (CONNECTION[action] if noticed else 20) + (10 if mood == "delighted" else 0)
    mention = mood == "delighted" and r.random() < (0.85 if customer == "tourist" else 0.5)
    mention = mention or (mood == "annoyed" and r.random() < 0.3)
    return {
        "noticed": noticed,
        "reaction": mood,
        "satisfaction": _clamp(satisfaction),
        "connection": _clamp(connection + r.randint(-6, 6)),
        "wait_annoyance": wait_annoyance,
        "would_mention": mention,
        "quote": r.choice(CUSTOMER_QUOTE[mood]),
    }
