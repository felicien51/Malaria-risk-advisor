import { useState, useEffect, useCallback } from "react";

const KEY_PREFIX = "mra:notify:";
const alreadyNotified = new Set(); // per-session, avoid repeat notifications

// Wraps the browser Notification API. Best-effort: requires the user to grant
// permission and keep the tab open — there is no service worker / push
// server here, so this only fires while the app is actually open.
export function useRiskNotifications(countyName) {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(KEY_PREFIX + countyName) === "1");
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  useEffect(() => {
    setEnabled(localStorage.getItem(KEY_PREFIX + countyName) === "1");
  }, [countyName]);

  const toggle = useCallback(async () => {
    if (typeof Notification === "undefined") return;

    if (!enabled) {
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
        setPermission(perm);
      }
      if (perm === "granted") {
        localStorage.setItem(KEY_PREFIX + countyName, "1");
        setEnabled(true);
      }
    } else {
      localStorage.removeItem(KEY_PREFIX + countyName);
      setEnabled(false);
    }
  }, [enabled, countyName]);

  const checkAndNotify = useCallback(
    (level, score) => {
      if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const notifyKey = `${countyName}:${level}`;
      if (level === "High" && !alreadyNotified.has(notifyKey)) {
        alreadyNotified.add(notifyKey);
        new Notification(`${countyName}: High malaria risk`, {
          body: `Risk score is ${score}/100. Rainfall, humidity and temperature currently favor mosquito breeding.`,
        });
      }
    },
    [enabled, countyName]
  );

  return { enabled, permission, toggle, checkAndNotify };
}
