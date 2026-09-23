import { useEffect, useState } from "react";

const STORAGE_KEY = "preview:auto-clear-cache";

function isPreviewEnv() {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  const h = window.location.hostname;
  return h.includes("lovable.app") || h === "localhost" || h === "127.0.0.1";
}

async function clearAll() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    try {
      sessionStorage.clear();
    } catch {}
  } catch (e) {
    console.warn("[preview cache] clear failed", e);
  }
}

export function PreviewCacheToggle() {
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  useEffect(() => {
    if (!isPreviewEnv()) return;
    setVisible(true);
    const on = localStorage.getItem(STORAGE_KEY) === "1";
    setEnabled(on);
    if (on) {
      clearAll().then(() => {
        setJustCleared(true);
        setTimeout(() => setJustCleared(false), 1500);
      });
    }
  }, []);

  if (!visible) return null;

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  };

  const clearNow = async () => {
    await clearAll();
    window.location.reload();
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 2147483000,
        display: "flex",
        gap: 6,
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        fontSize: 11,
        fontFamily: "system-ui, sans-serif",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={toggle} />
        Auto-clear cache on reload
      </label>
      <button
        onClick={clearNow}
        style={{
          background: "rgba(255,255,255,0.12)",
          border: "none",
          color: "#fff",
          padding: "3px 8px",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 11,
        }}
      >
        Clear now
      </button>
      {justCleared && <span style={{ color: "#7CFFB2" }}>✓ cleared</span>}
    </div>
  );
}
