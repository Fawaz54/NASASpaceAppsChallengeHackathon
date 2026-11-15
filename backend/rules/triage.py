"""Emergency questions and how the answers choose a checklist.

The questions are fixed so a critical one is never skipped. They adapt to
what happened (a cut is asked about depth, a bruise about colour), but the
four danger signs are always asked, because those catch threats to life.
The AI only helps by reading a typed description and pre-filling answers.
"""
from rules.engine import protocols

REGIONS = ["Head", "Neck", "Chest", "Abdomen", "Upper back", "Lower back",
           "Left arm", "Right arm", "Left leg", "Right leg"]

ONSETS = ["Just now", "Within the last hour", "Earlier today", "More than a day ago"]

# What happened, and the follow-up questions for each.
# A choice marked serious=True sends the crew member to the more urgent checklist.
TYPES = [
    {"id": "pain", "label": "Pain or ache", "protocol": None, "questions": [
        {"key": "feel", "question": "What does the pain feel like?",
         "choices": ["Dull ache", "Sharp or stabbing", "Pressure or tightness", "Burning or tingling"]},
        {"key": "movement", "question": "Does it get worse when you move?", "choices": ["No", "Yes"]},
    ]},
    {"id": "cut", "label": "Cut or scratch", "protocol": "EMG-CUT", "serious_protocol": "EMG-BLEED", "questions": [
        {"key": "depth", "question": "How deep is it?",
         "choices": ["Surface scratch", "Through the skin", "Deep or gaping"], "serious": ["Deep or gaping"]},
        {"key": "bleeding", "question": "Is it still bleeding?",
         "choices": ["No", "Oozing slowly", "Flowing or spurting"], "serious": ["Flowing or spurting"]},
        {"key": "object", "question": "Is anything stuck in the wound?", "choices": ["No", "Yes"]},
    ]},
    {"id": "bruise", "label": "Bruise or impact", "protocol": "EMG-BRUISE", "questions": [
        {"key": "colour", "question": "What colour is the bruise?",
         "choices": ["No mark yet", "Red", "Blue or purple", "Green or yellow"]},
        {"key": "swelling", "question": "Is there swelling?", "choices": ["No", "A little", "A lot"]},
        {"key": "movement", "question": "Can you move the area normally?", "choices": ["Yes", "It hurts to move", "I cannot move it"]},
    ]},
    {"id": "burn", "label": "Burn", "protocol": "EMG-BURN", "questions": [
        {"key": "skin", "question": "What does the skin look like?",
         "choices": ["Red, no blisters", "Blistered", "White, brown or charred"]},
        {"key": "size", "question": "How large is the burn?",
         "choices": ["Smaller than your palm", "Larger than your palm"]},
        {"key": "cause", "question": "What caused it?", "choices": ["Heat", "Chemical", "Electrical"]},
    ]},
    {"id": "ill", "label": "Feeling ill", "protocol": "EMG-ILL", "questions": [
        {"key": "symptoms", "question": "Which of these do you have?", "multiple": True,
         "choices": ["Fever or chills", "Nausea or vomiting", "Dizziness", "Headache", "Unusual tiredness"]},
    ]},
]

# Danger signs, most urgent first. Any "yes" decides the checklist.
SIGNS = [
    {"id": "breathing", "question": "Are you having trouble breathing?", "protocol": "EMG-BREATH"},
    {"id": "chest", "question": "Do you have chest pain or pressure?", "protocol": "EMG-CHEST"},
    {"id": "bleeding", "question": "Is there bleeding that will not stop?", "protocol": "EMG-BLEED"},
    {"id": "confusion", "question": "Did you faint, or do you feel confused?", "protocol": "EMG-NEURO"},
]

REGION_PROTOCOL = {
    "Head": "EMG-HEAD", "Neck": "EMG-BACK", "Chest": "EMG-CHEST", "Abdomen": "EMG-ABDO",
    "Upper back": "EMG-BACK", "Lower back": "EMG-BACK",
    "Left arm": "EMG-LIMB", "Right arm": "EMG-LIMB", "Left leg": "EMG-LIMB", "Right leg": "EMG-LIMB",
}


def questions():
    return {"regions": REGIONS, "onsets": ONSETS, "signs": SIGNS, "types": TYPES}


def find_type(type_id):
    return next((t for t in TYPES if t["id"] == type_id), None)


def describe_details(kind, details):
    """The follow-up answers as text lines for the flight surgeon."""
    lines = []
    for question in (kind or {}).get("questions", []):
        answer = (details or {}).get(question["key"])
        if answer:
            lines.append(f"{question['question']} {', '.join(answer) if isinstance(answer, list) else answer}")
    return lines


def choose(answers):
    """Returns the checklist for these answers."""
    chosen = None
    signs = set(answers.get("signs") or [])
    for sign in SIGNS:
        if sign["id"] in signs:
            chosen = sign["protocol"]
            break
    kind = find_type(answers.get("type"))
    if chosen is None and kind and kind["protocol"]:
        chosen = kind["protocol"]
        details = answers.get("details") or {}
        if any(details.get(q["key"]) in q.get("serious", []) for q in kind["questions"]):
            chosen = kind.get("serious_protocol", chosen)
    if chosen is None:
        for region in answers.get("regions") or []:
            if region in REGION_PROTOCOL:
                chosen = REGION_PROTOCOL[region]
                break
    chosen = chosen if chosen in protocols() else "EMG-GEN"
    return {"protocol_id": chosen, **protocols()[chosen]}
