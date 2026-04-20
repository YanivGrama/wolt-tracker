import React from "react";
import { useLocale } from "../i18n";

export default function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="lang-toggle" role="radiogroup" aria-label="Language">
      <button
        className={`lang-toggle-btn${locale === "en" ? " active" : ""}`}
        onClick={() => setLocale("en")}
        role="radio"
        aria-checked={locale === "en"}
      >
        EN
      </button>
      <button
        className={`lang-toggle-btn${locale === "he" ? " active" : ""}`}
        onClick={() => setLocale("he")}
        role="radio"
        aria-checked={locale === "he"}
      >
        עב
      </button>
    </div>
  );
}
