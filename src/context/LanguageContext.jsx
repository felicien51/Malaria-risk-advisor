import { createContext, useContext, useState } from "react";

const LanguageContext = createContext(null);

const LANG_KEY = "mra:lang";

// Covers navigation, headings, buttons, and static copy across every page.
// County names and live numeric data (scores, mm, %, °C) are not translated
// — those are values, not language-dependent text.
const STRINGS = {
  en: {
    navHome: "Home",
    navCompare: "Compare",
    navAbout: "Methodology",

    heroEyebrow: "Weather-driven public health tool",
    heroTitle: "Malaria risk, read from the sky.",
    heroBody:
      "Rainfall, humidity and temperature drive mosquito breeding conditions. Pick a county to see today's estimated risk and a 16-day outlook.",
    searchPlaceholder: "Search a county or region",
    noMatch: 'No counties match "{query}"',
    countyCount: "{count} of {total} counties",

    dashTitle: "Malaria risk advisor",
    countyNotFound: "County not found.",
    backToList: "Back to county list",
    changeCounty: "Change county",
    share: "Share",
    linkCopied: "Link copied to clipboard",
    fetching: "Fetching weather data for {county}…",
    errorLoad: "Couldn't load weather data",
    retry: "Retry",

    rainfall14d: "Rainfall, 14d",
    avgHumidity: "Avg humidity",
    avgTemp: "Avg temp",
    trend14d: "14d trend",
    trendRising: "Rising",
    trendFalling: "Falling",
    trendSteady: "Steady",

    download: "Download card",
    notify: "Notify me if High",
    notifyOn: "Notifications on",

    sessionTitle: "This session",
    sessionDesc: "Risk score seen so far this visit (resets on reload)",
    forecastTitle: "16-day forecast",
    rainfallLegend: "rainfall",
    temperatureLegend: "temperature",
    viewForecast: "View detailed forecast",
    disclaimer: "Educational estimate, not a medical diagnosis",

    compareTitle: "Compare counties",
    comparePick: "Pick up to {count} to compare side by side",
    compareSelect: "Select a county above to get started",
    couldNotLoadData: "Couldn't load data.",

    aboutTitle: "How risk is calculated",
    aboutBody:
      "Risk is estimated from rainfall, humidity and temperature over the trailing 14 days, weighted against conditions known to favor Anopheles mosquito breeding and survival. Each factor contributes to a 0-100 score, split roughly 40% rainfall, 30% humidity, 30% temperature.",
    factorRainfallTitle: "Rainfall",
    factorRainfallDesc: "Sustained rain creates standing water where mosquitoes breed.",
    factorHumidityTitle: "Humidity",
    factorHumidityDesc: "Relative humidity above roughly 60% extends adult mosquito lifespan.",
    factorTempTitle: "Temperature",
    factorTempDesc: "20-30°C speeds up parasite development inside the mosquito.",
    warningBox:
      "This is an educational estimate, not a medical diagnosis. If you have symptoms or concerns, consult a health facility.",

    forecastBack: "Back to dashboard",
    forecastPageTitle: "{county} forecast",
    forecastSubtitle: "Rainfall & temperature outlook",
    days7: "7 days",
    days16: "16 days",
    loadingForecast: "Loading forecast…",
    rainfallTempRange: "Rainfall & temperature, next {range} days",
    totalRainfall: "Total rainfall",
    peakRainDay: "Peak rain day",
    day: "Day {n}",
  },
  sw: {
    navHome: "Nyumbani",
    navCompare: "Linganisha",
    navAbout: "Mbinu",

    heroEyebrow: "Zana ya afya ya umma inayotegemea hali ya hewa",
    heroTitle: "Hatari ya malaria, kutoka angani.",
    heroBody:
      "Mvua, unyevu na joto huathiri mazalia ya mbu. Chagua kaunti kuona hatari ya leo na muonekano wa siku 16.",
    searchPlaceholder: "Tafuta kaunti au eneo",
    noMatch: 'Hakuna kaunti inayolingana na "{query}"',
    countyCount: "Kaunti {count} kati ya {total}",

    dashTitle: "Kipimo cha hatari ya malaria",
    countyNotFound: "Kaunti haikupatikana.",
    backToList: "Rudi kwenye orodha ya kaunti",
    changeCounty: "Badilisha kaunti",
    share: "Shiriki",
    linkCopied: "Kiungo kimenakiliwa",
    fetching: "Inapakua data ya hali ya hewa ya {county}…",
    errorLoad: "Imeshindwa kupakua data ya hali ya hewa",
    retry: "Jaribu tena",

    rainfall14d: "Mvua, siku 14",
    avgHumidity: "Wastani wa unyevu",
    avgTemp: "Wastani wa joto",
    trend14d: "Mwelekeo wa siku 14",
    trendRising: "Inaongezeka",
    trendFalling: "Inapungua",
    trendSteady: "Thabiti",

    download: "Pakua kadi",
    notify: "Nijulishe ikiwa Juu",
    notifyOn: "Arifa zimewashwa",

    sessionTitle: "Kikao hiki",
    sessionDesc: "Kiwango cha hatari kilichoonekana katika ziara hii (kinafutwa ukipakua upya)",
    forecastTitle: "Utabiri wa siku 16",
    rainfallLegend: "mvua",
    temperatureLegend: "joto",
    viewForecast: "Angalia utabiri kamili",
    disclaimer: "Makadirio ya kielimu, si uchunguzi wa kimatibabu",

    compareTitle: "Linganisha kaunti",
    comparePick: "Chagua hadi {count} kulinganisha pamoja",
    compareSelect: "Chagua kaunti hapo juu ili kuanza",
    couldNotLoadData: "Imeshindwa kupakua data.",

    aboutTitle: "Jinsi hatari inavyokadiriwa",
    aboutBody:
      "Hatari inakadiriwa kutokana na mvua, unyevu na joto la siku 14 zilizopita, likilinganishwa na hali zinazojulikana kupendelea mazalia na kuishi kwa mbu wa Anopheles. Kila kipengele huchangia alama ya 0-100, ikigawanywa kwa asilimia 40 mvua, asilimia 30 unyevu, asilimia 30 joto.",
    factorRainfallTitle: "Mvua",
    factorRainfallDesc: "Mvua ya kudumu huunda maji yaliyotuama mahali mbu huzaliana.",
    factorHumidityTitle: "Unyevu",
    factorHumidityDesc: "Unyevu wa zaidi ya asilimia 60 huongeza muda wa maisha wa mbu.",
    factorTempTitle: "Joto",
    factorTempDesc: "Nyuzi 20-30°C huharakisha ukuaji wa vimelea ndani ya mbu.",
    warningBox:
      "Hii ni makadirio ya kielimu, si uchunguzi wa kimatibabu. Ukiwa na dalili au wasiwasi, wasiliana na kituo cha afya.",

    forecastBack: "Rudi kwenye dashibodi",
    forecastPageTitle: "Utabiri wa {county}",
    forecastSubtitle: "Muonekano wa mvua na joto",
    days7: "Siku 7",
    days16: "Siku 16",
    loadingForecast: "Inapakua utabiri…",
    rainfallTempRange: "Mvua na joto, siku {range} zijazo",
    totalRainfall: "Jumla ya mvua",
    peakRainDay: "Siku ya mvua nyingi zaidi",
    day: "Siku {n}",
  },
};

function interpolate(str, vars) {
  if (!vars) return str;
  return Object.keys(vars).reduce((s, key) => s.replaceAll(`{${key}}`, vars[key]), str);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || "en");

  const toggleLang = () => {
    setLang((prev) => {
      const next = prev === "en" ? "sw" : "en";
      localStorage.setItem(LANG_KEY, next);
      return next;
    });
  };

  const t = (key, vars) => interpolate(STRINGS[lang][key] || STRINGS.en[key] || key, vars);

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
