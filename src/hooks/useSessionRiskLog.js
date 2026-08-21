import { useState, useCallback } from "react";

// Session-only (not persisted across reloads) log of risk scores per county,
// so a user can see how the score moved during their visit.
const sessionLog = {};

export function useSessionRiskLog(countyName) {
  const [, forceUpdate] = useState(0);

  const record = useCallback(
    (score) => {
      const entry = { score, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      const log = sessionLog[countyName] || [];
      const last = log[log.length - 1];
      if (!last || last.score !== score) {
        sessionLog[countyName] = [...log, entry].slice(-10);
        forceUpdate((n) => n + 1);
      }
    },
    [countyName]
  );

  return { history: sessionLog[countyName] || [], record };
}
