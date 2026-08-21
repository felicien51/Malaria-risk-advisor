import { createContext, useContext, useState } from "react";

const LanguageContext = createContext(null);

const LANG_KEY = "mra:lang";

// Deliberately scoped to app chrome and key headings, not every dynamic
// string (county names, exact numbers) — a full translation of generated
// content is out of scope for Phase 1.
const STRINGS = {
  en: {
    navHome: "Home",
    navCompare: "Compare",
    navAbout: "Methodology",
    navMap: "Map",
    heroTitle: "Malaria risk, read from the sky.",
    heroBody:
      "Rainfall, humidity and temperature drive mosquito breeding conditions. Pick a county to see today's estimated risk and a 16-day outlook.",
    searchPlaceholder: "Search a county or region",
    riskIndex: "RISK INDEX",
    disclaimer: "Educational estimate, not a medical diagnosis",
    share: "Share",
    linkCopied: "Link copied to clipboard",
    download: "Download card",
    notify: "Notify me if High",
    notifyOn: "Notifications on",
  },
  sw: {
    navHome: "Nyumbani",
    navCompare: "Linganisha",
    navAbout: "Mbinu",
    navMap: "Ramani",
    heroTitle: "Hatari ya malaria, kutoka angani.",
    heroBody:
      "Mvua, unyevu na joto huathiri mazalia ya mbu. Chagua kaunti kuona hatari ya leo na muonekano wa siku 16.",
    searchPlaceholder: "Tafuta kaunti au eneo",
    riskIndex: "KIWANGO CHA HATARI",
    disclaimer: "Makadirio ya kielimu, si uchunguzi wa kimatibabu",
    share: "Shiriki",
    linkCopied: "Kiungo kimenakiliwa",
    download: "Pakua kadi",
    notify: "Nijulishe ikiwa Juu",
    notifyOn: "Arifa zimewashwa",
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || "en");

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "en" ? "sw" : "en";
      localStorage.setItem(LANG_KEY, next);
      return next;
    });
  };

  const t = (key) => STRINGS[lang][key] || STRINGS.en[key] || key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
