/**
 * Indian mobile number formatting, validation, and normalization utilities.
 * 
 * FLORETTTZ serves customers in India only.
 * The standard format is: +91<10-digit mobile number starting with 6, 7, 8, or 9>.
 */

export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export interface PhoneValidationResult {
  isValid: boolean;
  rawDigits: string;
  normalized: string; // E.164 format: +91XXXXXXXXXX
  error?: string;
}

/**
 * Strips formatting, extracts digits, removes redundant country/trunk prefixes if pasted,
 * and validates according to Indian mobile number standards.
 */
export function validateAndNormalizeIndianPhone(input: string): PhoneValidationResult {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      rawDigits: "",
      normalized: "",
      error: "Enter your 10-digit Indian mobile number.",
    };
  }

  const trimmed = input.trim();

  // Check for invalid characters
  if (/[^\d\s\-\.\(\)\+]/.test(trimmed)) {
    return {
      isValid: false,
      rawDigits: "",
      normalized: "",
      error: "Phone number contains invalid characters. Enter digits only.",
    };
  }

  // Check for multiple country codes or multiple plus signs
  const plusCount = (trimmed.match(/\+/g) || []).length;
  if (plusCount > 1) {
    return {
      isValid: false,
      rawDigits: "",
      normalized: "",
      error: "Multiple country codes detected. Please enter only your 10-digit mobile number.",
    };
  }

  // Detect non-Indian country codes
  if (trimmed.startsWith("+") && !trimmed.startsWith("+91")) {
    return {
      isValid: false,
      rawDigits: "",
      normalized: "",
      error: "Floretttz currently serves India only (+91). International numbers are not supported.",
    };
  }

  // Strip +91 if present
  let working = trimmed;
  if (working.startsWith("+91")) {
    working = working.slice(3);
  } else if (working.startsWith("+")) {
    working = working.slice(1);
  }

  // Extract digits
  let digits = working.replace(/\D/g, "");

  // If user pasted 91 followed by 10 digits (total 12 digits starting with 91)
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  // If user entered trunk 0 prefix (11 digits starting with 0)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Check length
  if (digits.length < 10) {
    return {
      isValid: false,
      rawDigits: digits,
      normalized: digits ? `+91${digits}` : "",
      error: `Please enter all 10 digits (${digits.length}/10 entered).`,
    };
  }

  if (digits.length > 10) {
    return {
      isValid: false,
      rawDigits: digits,
      normalized: `+91${digits.slice(0, 10)}`,
      error: "Mobile number cannot exceed 10 digits.",
    };
  }

  // Check plausible Indian mobile number prefix (6, 7, 8, 9)
  if (!INDIAN_MOBILE_REGEX.test(digits)) {
    return {
      isValid: false,
      rawDigits: digits,
      normalized: `+91${digits}`,
      error: "Invalid Indian mobile number. Indian mobile numbers must start with 6, 7, 8, or 9.",
    };
  }

  return {
    isValid: true,
    rawDigits: digits,
    normalized: `+91${digits}`,
  };
}

/**
 * Cleans an incoming value to store only the 10 local digits.
 * Useful for controlled inputs where the +91 prefix is shown in a fixed container.
 */
export function cleanLocalMobileDigits(input: string): string {
  let cleaned = input.trim();
  if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);

  let digits = cleaned.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  return digits.slice(0, 10);
}
