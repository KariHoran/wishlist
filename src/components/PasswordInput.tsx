"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  required,
}: {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="input-field pr-12"
      />
      <button
        type="button"
        aria-label={show ? t("hidePassword") : t("showPassword")}
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-3 -translate-y-1/2 pixel-font text-xs"
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <path
        d="M1 8C3 3 7 1 11 1s8 2 10 7c-2 5-6 7-10 7S3 13 1 8z"
        stroke="#000"
        strokeWidth="1.5"
        fill="#fff"
      />
      <circle cx="11" cy="8" r="3" fill={open ? "#000" : "#fff"} stroke="#000" />
      {!open && <path d="M2 14 L20 2" stroke="#000" strokeWidth="1.5" />}
    </svg>
  );
}
