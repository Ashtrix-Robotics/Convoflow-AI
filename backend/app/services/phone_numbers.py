from __future__ import annotations

import re


def normalize_phone_number(phone: str | None, default_country_code: str = "91") -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if digits.startswith("00"):
        digits = digits[2:]
    default_country_code = re.sub(r"\D+", "", default_country_code or "")
    if digits and default_country_code and len(digits) == 10:
        digits = f"{default_country_code}{digits}"
    return digits


def format_phone_e164(phone: str | None, default_country_code: str = "91") -> str:
    normalized = normalize_phone_number(phone, default_country_code)
    return f"+{normalized}" if normalized else ""


def phone_lookup_variants(phone: str | None, default_country_code: str = "91") -> list[str]:
    normalized = normalize_phone_number(phone, default_country_code)
    if not normalized:
        return []

    variants: list[str] = [normalized, f"+{normalized}"]
    default_country_code = re.sub(r"\D+", "", default_country_code or "")
    if default_country_code and normalized.startswith(default_country_code):
        local_number = normalized[len(default_country_code):]
        if local_number:
            variants.extend([local_number, f"+{local_number}"])

    seen: set[str] = set()
    ordered: list[str] = []
    for value in variants:
        if value and value not in seen:
            seen.add(value)
            ordered.append(value)
    return ordered


def phones_match(left: str | None, right: str | None, default_country_code: str = "91") -> bool:
    return normalize_phone_number(left, default_country_code) == normalize_phone_number(right, default_country_code)