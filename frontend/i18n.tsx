import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Locale = "en" | "he";

const translations = {
  en: {
    "brand": "Wolt Tracker",

    // Landing
    "landing.hero.title1": "Track your Wolt delivery",
    "landing.hero.title2": "real time",
    "landing.hero.subtitle": "Paste your tracking link below — we'll show you exactly where your courier is and when to expect your order.",
    "landing.chip.realtime": "Real-time",
    "landing.chip.push": "Push alerts",
    "landing.chip.share": "Shareable",
    "landing.input.label": "Wolt tracking URL",
    "landing.input.placeholder": "Paste your Wolt tracking link…",
    "landing.input.hint": "Link looks like: track.wolt.com/…/s/AbCdEf…",
    "landing.input.btn": "Track delivery",
    "landing.error.invalid": "That doesn't look like a valid Wolt tracking link. It should start with track.wolt.com.",
    "landing.error.generic": "Something went wrong. Please try again.",
    "landing.error.network": "Network error. Please check your connection and try again.",
    "landing.recent.title": "Recent deliveries",
    "landing.recent.total": "total",
    "landing.recent.events": "events",

    // Steps
    "step.0": "Not started",
    "step.1": "Received",
    "step.2": "Confirmed",
    "step.3": "Preparing",
    "step.4": "On the way",
    "step.5": "Delivered",
    "step.label.1": "Order received",
    "step.label.2": "Order confirmed",
    "step.label.3": "Being prepared",
    "step.label.4": "On the way",
    "step.label.5": "Delivered",

    // Time
    "time.justNow": "just now",
    "time.mAgo": "{n}m ago",
    "time.hAgo": "{n}h ago",

    // Tracker
    "tracker.connecting": "Connecting to tracker…",
    "tracker.notfound.title": "No tracking data found",
    "tracker.notfound.desc1": "We couldn't find any data for",
    "tracker.notfound.desc2": "The link may be expired or the tracking hasn't started yet.",
    "tracker.notfound.btn": "Track a new delivery",
    "tracker.invalid.title": "Invalid tracking URL",
    "tracker.invalid.desc": "No tracking code found in the URL.",
    "tracker.invalid.btn": "Go home",
    "tracker.share": "Share",
    "tracker.share.title": "Share tracking link",
    "tracker.share.toast": "Link copied to clipboard",
    "tracker.share.label": "Copy this link:",
    "tracker.share.done": "Done",
    "tracker.notif.on": "Notifs on",
    "tracker.notif.off": "Notify me",
    "tracker.notif.disable": "Disable notifications",
    "tracker.notif.enable": "Enable notifications",
    "tracker.delivered": "Delivered",
    "tracker.delivered.sub": "Order complete",
    "tracker.eta.min": "min to delivery",
    "tracker.back": "Back to home",

    // Status panel
    "status.noData": "No data yet",
    "status.noData.desc": "Waiting for the first tracking update…",
    "status.stepOf": "Step {n}/5 —",
    "status.eta": "ETA",
    "status.eta.min": "{n} min",
    "status.updated": "Updated",
    "status.destination": "Destination",
    "status.courier": "Courier position",
    "status.badge.live": "Live",
    "status.badge.history": "History",
    "status.badge.reconnecting": "Reconnecting",
    "status.badge.waiting": "Waiting",

    // Timeline
    "timeline.first": "First event",
    "timeline.prev": "Previous",
    "timeline.prevEvent": "Previous event",
    "timeline.play": "Play",
    "timeline.playThrough": "Play through events",
    "timeline.pause": "Pause",
    "timeline.pausePlayback": "Pause playback",
    "timeline.next": "Next",
    "timeline.nextEvent": "Next event",
    "timeline.latest": "Latest event",
    "timeline.live": "Live",

    // Delivery complete
    "delivered.title": "Delivered!",
    "delivered.desc": "Your order from {name} has arrived.",
    "delivered.totalTime": "Total time",
    "delivered.updates": "Status updates",
    "delivered.trackAnother": "Track another delivery",

    // Map
    "map.loading": "Map loading…",
    "map.loadingDesc": "Fetching tiles, one sec.",
    "map.delivered": "Delivered",
    "map.deliveredDesc": "Your order arrived. Location data isn't available for this delivery.",
    "map.waiting": "Waiting for location…",
    "map.waitingDesc": "We'll pin the courier as soon as GPS data comes through.",
    "map.restaurant": "Restaurant",
    "map.destination": "Delivery destination",
    "map.courier": "Courier",

    // Theme
    "theme.switchTo": "Switch to {mode} mode",
    "theme.light": "light",
    "theme.dark": "dark",
  },
  he: {
    "brand": "Wolt Tracker",

    // Landing
    "landing.hero.title1": "עקוב אחרי משלוח הוולט שלך",
    "landing.hero.title2": "בזמן אמת",
    "landing.hero.subtitle": "הדבק את קישור המעקב למטה — נראה לך בדיוק איפה השליח ומתי ההזמנה תגיע.",
    "landing.chip.realtime": "זמן אמת",
    "landing.chip.push": "התראות פוש",
    "landing.chip.share": "שיתוף קישור",
    "landing.input.label": "קישור מעקב Wolt",
    "landing.input.placeholder": "הדבק את קישור המעקב מ-Wolt…",
    "landing.input.hint": "הקישור נראה כך: track.wolt.com/…/s/AbCdEf…",
    "landing.input.btn": "עקוב אחרי המשלוח",
    "landing.error.invalid": "זה לא נראה כמו קישור מעקב תקין של Wolt. הוא צריך להתחיל ב-track.wolt.com.",
    "landing.error.generic": "משהו השתבש. נסה שוב.",
    "landing.error.network": "שגיאת רשת. בדוק את החיבור ונסה שוב.",
    "landing.recent.title": "משלוחים אחרונים",
    "landing.recent.total": "סה״כ",
    "landing.recent.events": "אירועים",

    // Steps
    "step.0": "לא התחיל",
    "step.1": "התקבל",
    "step.2": "אושר",
    "step.3": "בהכנה",
    "step.4": "בדרך",
    "step.5": "הגיע",
    "step.label.1": "ההזמנה התקבלה",
    "step.label.2": "ההזמנה אושרה",
    "step.label.3": "בהכנה",
    "step.label.4": "בדרך אליך",
    "step.label.5": "הגיע!",

    // Time
    "time.justNow": "עכשיו",
    "time.mAgo": "לפני {n} דק׳",
    "time.hAgo": "לפני {n} שע׳",

    // Tracker
    "tracker.connecting": "מתחבר למעקב…",
    "tracker.notfound.title": "לא נמצאו נתוני מעקב",
    "tracker.notfound.desc1": "לא הצלחנו למצוא נתונים עבור",
    "tracker.notfound.desc2": "יתכן שהקישור פג תוקף או שהמעקב עדיין לא התחיל.",
    "tracker.notfound.btn": "עקוב אחרי משלוח חדש",
    "tracker.invalid.title": "כתובת מעקב לא תקינה",
    "tracker.invalid.desc": "לא נמצא קוד מעקב בכתובת.",
    "tracker.invalid.btn": "חזרה לדף הבית",
    "tracker.share": "שתף",
    "tracker.share.title": "שתף קישור מעקב",
    "tracker.share.toast": "הקישור הועתק ללוח",
    "tracker.share.label": "העתק את הקישור:",
    "tracker.share.done": "סגור",
    "tracker.notif.on": "התראות פעילות",
    "tracker.notif.off": "הפעל התראות",
    "tracker.notif.disable": "כבה התראות",
    "tracker.notif.enable": "הפעל התראות",
    "tracker.delivered": "הגיע!",
    "tracker.delivered.sub": "ההזמנה הושלמה",
    "tracker.eta.min": "דק׳ למשלוח",
    "tracker.back": "חזרה לדף הבית",

    // Status panel
    "status.noData": "אין נתונים עדיין",
    "status.noData.desc": "ממתינים לעדכון המעקב הראשון…",
    "status.stepOf": "שלב {n}/5 —",
    "status.eta": "זמן משוער",
    "status.eta.min": "{n} דק׳",
    "status.updated": "עודכן",
    "status.destination": "יעד",
    "status.courier": "מיקום השליח",
    "status.badge.live": "חי",
    "status.badge.history": "היסטוריה",
    "status.badge.reconnecting": "מתחבר מחדש",
    "status.badge.waiting": "ממתין",

    // Timeline
    "timeline.first": "אירוע ראשון",
    "timeline.prev": "הקודם",
    "timeline.prevEvent": "אירוע קודם",
    "timeline.play": "הפעל",
    "timeline.playThrough": "הפעל את כל האירועים",
    "timeline.pause": "השהה",
    "timeline.pausePlayback": "השהה הפעלה",
    "timeline.next": "הבא",
    "timeline.nextEvent": "אירוע הבא",
    "timeline.latest": "אירוע אחרון",
    "timeline.live": "חי",

    // Delivery complete
    "delivered.title": "הגיע!",
    "delivered.desc": "ההזמנה שלך מ-{name} הגיעה.",
    "delivered.totalTime": "זמן כולל",
    "delivered.updates": "עדכוני סטטוס",
    "delivered.trackAnother": "עקוב אחרי משלוח נוסף",

    // Map
    "map.loading": "טוען מפה…",
    "map.loadingDesc": "מוריד נתונים, רגע.",
    "map.delivered": "הגיע",
    "map.deliveredDesc": "ההזמנה שלך הגיעה. אין נתוני מיקום עבור משלוח זה.",
    "map.waiting": "ממתין למיקום…",
    "map.waitingDesc": "נסמן את השליח ברגע שנקבל נתוני GPS.",
    "map.restaurant": "מסעדה",
    "map.destination": "יעד המשלוח",
    "map.courier": "שליח",

    // Theme
    "theme.switchTo": "עבור למצב {mode}",
    "theme.light": "בהיר",
    "theme.dark": "כהה",
  },
} as const;

type TranslationKey = keyof (typeof translations)["en"];

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem("wolt-tracker-locale") as Locale | null;
    return stored === "he" ? "he" : "en";
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("wolt-tracker-locale", l);
  }, []);

  useEffect(() => {
    const dir = locale === "he" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let str = (translations[locale] as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function timeLocale(locale: Locale): string {
  return locale === "he" ? "he-IL" : "en-GB";
}
