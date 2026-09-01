"""Polar Wet Food Feeder (PLAF109)."""

import time

DEVICE_TYPES = ["polar"]

MQTT_MODELS = {
    "polar": "PLAF109",
}

ALERT_MESSAGES = {
    "bowl_due": "Food bowl needs cleaning.",
}

DEFAULT_NOTIFICATIONS = {
    "bowl_due": True,
}


def compute_alerts(state: dict, cfg: dict, online: bool) -> set:
    """Return app-local maintenance reminders only; PLAF109 alerts are unverified."""
    if not cfg.get("notifications", {}).get("bowl_due", True):
        return set()
    last_cleaned = cfg.get("last_bowl_cleaned_ts")
    if not isinstance(last_cleaned, (int, float)):
        return set()
    interval = cfg.get("bowl_cleaning_interval_days", 7)
    if not isinstance(interval, (int, float)) or interval <= 0:
        return set()
    if (time.time() - last_cleaned / 1000) / 86400 >= interval:
        return {"bowl_due"}
    return set()


def track_intake(old_state: dict, new_state: dict, min_grams: float = 5) -> float | None:
    return None
