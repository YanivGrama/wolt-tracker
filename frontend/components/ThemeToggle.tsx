import React, { useState, useEffect } from "react";
import { useLocale } from "../i18n";
import { Sun, Moon } from "./Icons";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
}

export default function ThemeToggle() {
  const { t } = useLocale();
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("wolt-tracker-theme") as Theme | null;
    return stored ?? "system";
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("wolt-tracker-theme", theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") applyTheme("system"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function toggle() {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setTheme(resolved === "dark" ? "light" : "dark");
  }

  const resolved = theme === "system" ? getSystemTheme() : theme;
  const nextMode = resolved === "dark" ? t("theme.light") : t("theme.dark");
  const label = t("theme.switchTo", { mode: nextMode });

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={label}
      aria-label={label}
    >
      {resolved === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
