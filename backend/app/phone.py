"""India-specific phone number normalization and validation.

FLORETTTZ serves customers in India only.
Customer and checkout forms accept 10-digit Indian mobile numbers and normalize
them into standard E.164 format: +91<10-digits>.
"""

import re

# Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
INDIAN_MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")
PERMITTED_SEPARATORS_REGEX = re.compile(r"[ \-\.\(\)]")


class PhoneValidationError(ValueError):
    """Raised when phone number does not conform to Indian mobile rules."""
    pass


def normalize_indian_mobile(value: str, allow_existing_international: bool = False) -> str:
    """Validate and normalize an Indian mobile number to E.164 (+91XXXXXXXXXX).

    Args:
        value: Input phone string from user, payload, or database.
        allow_existing_international: If True, preserves existing non-Indian international
            numbers as-is to avoid silent data corruption during migrations.

    Returns:
        Normalized E.164 string: +91 followed by 10 digits (e.g. +919876543210).

    Raises:
        PhoneValidationError: If input is invalid, not 10 digits, starts with invalid prefix,
            contains multiple country codes, or is an unsupported international number.
    """
    if not value or not isinstance(value, str):
        raise PhoneValidationError("Phone number is required")

    trimmed = value.strip()
    if not trimmed:
        raise PhoneValidationError("Phone number cannot be empty")

    # Reject unsupported characters
    if not all(ch.isdigit() or ch in "+ -()." for ch in trimmed):
        raise PhoneValidationError("Phone number contains unsupported characters")

    # Reject multiple '+' or '+' not at the beginning
    plus_count = trimmed.count("+")
    if plus_count > 1:
        raise PhoneValidationError("Multiple country codes or '+' symbols are not permitted")
    if plus_count == 1 and not trimmed.startswith("+"):
        raise PhoneValidationError("Country code '+' must only appear at the beginning")

    # Check for existing non-Indian international format
    if trimmed.startswith("+") and not trimmed.startswith("+91"):
        if allow_existing_international:
            # Clean separators while preserving explicit international code
            cleaned_intl = "+" + re.sub(r"\D", "", trimmed[1:])
            return cleaned_intl
        raise PhoneValidationError(
            "Floretttz currently serves customers in India only. Only Indian mobile numbers (+91) are supported."
        )

    # Remove +91 prefix if present
    working = trimmed
    if working.startswith("+91"):
        working = working[3:]
    elif working.startswith("+"):
        # Any other + was handled above
        working = working[1:]

    # Remove permitted separators (spaces, dashes, dots, parentheses)
    digits_only = re.sub(r"\D", "", working)

    # Detect if user entered a redundant second country code e.g. 919876543210 after +91
    if trimmed.startswith("+91") and digits_only.startswith("91") and len(digits_only) == 12:
        raise PhoneValidationError(
            "Multiple country codes detected. Please enter only your 10-digit mobile number."
        )

    # If without + the user typed 91 prefix (12 digits total starting with 91 followed by [6-9])
    if len(digits_only) == 12 and digits_only.startswith("91"):
        digits_only = digits_only[2:]

    # If user entered trunk prefix 0 (11 digits starting with 0 followed by [6-9])
    if len(digits_only) == 11 and digits_only.startswith("0"):
        digits_only = digits_only[1:]

    # Must now be exactly 10 digits
    if len(digits_only) < 10:
        raise PhoneValidationError("Indian mobile number must be exactly 10 digits")
    if len(digits_only) > 10:
        raise PhoneValidationError("Indian mobile number cannot exceed 10 digits")

    # Validate standard Indian mobile prefix (starts with 6, 7, 8, or 9)
    if not INDIAN_MOBILE_REGEX.match(digits_only):
        raise PhoneValidationError(
            "Invalid Indian mobile number. Plausible Indian mobile numbers must start with 6, 7, 8, or 9."
        )

    return f"+91{digits_only}"


def is_valid_indian_mobile(value: str) -> bool:
    """Return True if the value is or normalizes to a plausible Indian mobile number."""
    try:
        normalize_indian_mobile(value)
        return True
    except PhoneValidationError:
        return False
