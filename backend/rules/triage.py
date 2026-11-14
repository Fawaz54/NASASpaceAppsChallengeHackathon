"""Emergency questions and how the answers choose a checklist.

The questions are fixed so a critical one is never skipped. The AI only
helps by reading a typed description and pre-filling answers.
"""
from rules.engine import protocols

REGIONS = ["Head", "Neck", "Chest", "Abdomen", "Upper back", "Lower back",
           "Left arm", "Right arm", "Left leg", "Right leg"]

ONSETS = ["Just now", "Within the last hour", "Earlier today", "More than a day"]

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
    return {"regions": REGIONS, "onsets": ONSETS, "signs": SIGNS}


def choose(answers):
    """Returns the checklist for these answers."""
    chosen = "EMG-GEN"
    signs = set(answers.get("signs") or [])
    for sign in SIGNS:
        if sign["id"] in signs:
            chosen = sign["protocol"]
            break
    else:
        for region in answers.get("regions") or []:
            if region in REGION_PROTOCOL:
                chosen = REGION_PROTOCOL[region]
                break
    protocol = protocols().get(chosen) or protocols().get("EMG-GEN")
    return {"protocol_id": chosen, **protocol}
