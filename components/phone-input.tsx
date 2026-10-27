"use client";

import React, { ChangeEvent, ClipboardEvent, useId, useState } from "react";
import { cleanLocalMobileDigits, validateAndNormalizeIndianPhone } from "@/lib/phone";

interface PhoneInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (normalized: string, rawDigits: string, isValid: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  showHelper?: boolean;
  customError?: string;
}

export function PhoneInput({
  id: propId,
  name = "customer_phone",
  label = "WhatsApp number",
  value,
  onChange,
  required = true,
  disabled = false,
  autoComplete = "tel-national",
  className = "",
  showHelper = true,
  customError,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = propId || `phone-input-${generatedId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;

  const [touched, setTouched] = useState(false);

  // Derive the 10-digit raw value for display in the local input
  const localDigits = cleanLocalMobileDigits(value);
  const validation = validateAndNormalizeIndianPhone(localDigits);

  const displayError = customError || (touched && localDigits.length > 0 && !validation.isValid ? validation.error : undefined);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cleaned = cleanLocalMobileDigits(raw);
    const result = validateAndNormalizeIndianPhone(cleaned);
    onChange(result.normalized, cleaned, result.isValid);
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const cleaned = cleanLocalMobileDigits(pasted);
    const result = validateAndNormalizeIndianPhone(cleaned);
    onChange(result.normalized, cleaned, result.isValid);
    setTouched(true);
  }

  return (
    <div className={`grid gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-ink">
          {label} {required && <span className="text-rose" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Input container with fixed +91 prefix: 🇮🇳 +91 | [ Enter 10-digit mobile number ] */}
      <div
        className={`flex min-h-[46px] w-full items-center rounded-lg border bg-white transition-colors focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/20 ${
          displayError ? "border-red-400 bg-red-50/20" : "border-[#c7babb]"
        } ${disabled ? "opacity-60 bg-gray-50" : ""}`}
      >
        {/* Fixed, non-editable country prefix */}
        <div
          className="flex shrink-0 select-none items-center gap-1.5 border-r border-[#c7babb]/80 bg-[#fbf5f2] px-3.5 py-2.5 text-sm font-bold text-forest"
          aria-hidden="true"
        >
          <span role="img" aria-label="India flag" className="text-base leading-none">
            🇮🇳
          </span>
          <span className="font-mono text-[0.95rem] tracking-tight">+91</span>
        </div>

        {/* 10-digit mobile number input */}
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder="9876543210"
          value={localDigits}
          onChange={handleChange}
          onPaste={handlePaste}
          onBlur={() => setTouched(true)}
          aria-describedby={`${showHelper ? helperId : ""} ${displayError ? errorId : ""}`.trim() || undefined}
          aria-invalid={Boolean(displayError)}
          className="h-full w-full border-0 bg-transparent px-3 py-2 text-base font-medium text-ink placeholder:text-ink/40 focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>

      {/* Helper text */}
      {showHelper && !displayError && (
        <p id={helperId} className="text-xs text-ink/65 leading-4">
          Enter your 10-digit Indian mobile number.
        </p>
      )}

      {/* Error message */}
      {displayError && (
        <p id={errorId} role="alert" className="text-xs font-semibold text-red-700 leading-4">
          {displayError}
        </p>
      )}
    </div>
  );
}
