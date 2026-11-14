"""Owner: Backend B. The message to the flight surgeon and the simulated Earth delay."""

DELAY_MINUTES = 19  # one-way signal delay used in the demo


def earth_link_state(alert):
    """The earth_link part of the state in docs/contract.md."""
    if alert is None:
        return {"delay_minutes": DELAY_MINUTES, "summary_sent": False, "reply_eta_minutes": None}
    # A reply needs the trip there and back; doctor thinking time is not modelled yet.
    return {"delay_minutes": DELAY_MINUTES, "summary_sent": True, "reply_eta_minutes": DELAY_MINUTES * 2}


# TODO (Backend B):
# - write the summary text: what changed, what was advised, what the astronaut did
# - remember when the summary was sent so reply_eta_minutes counts down
# - show a scripted doctor reply when the countdown reaches zero
