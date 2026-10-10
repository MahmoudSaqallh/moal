"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MonitorX, Store } from "lucide-react";
import { STORES } from "@/data/stores";
import { useExperienceStore } from "@/stores/useExperienceStore";
import { detectQuality, useSettingsStore } from "@/stores/useSettingsStore";
import { useCartStore } from "@/stores/useCartStore";
import { useAvatarStore } from "@/stores/useAvatarStore";
import { audio } from "@/lib/audio";
import { installDebugHook } from "@/features/exploration/debug";
import { REALTIME_URL, connectPresence, disconnectPresence } from "@/features/multiplayer/client";
import { AvatarPicker } from "./avatar/AvatarPicker";
import { AssistantPanel } from "./assistant/AssistantPanel";
import { LoadingScreen } from "./layout/LoadingScreen";
import { IntroOverlay } from "./layout/IntroOverlay";
import { HUD, Toast } from "./layout/HUD";
import { SettingsPanel, HelpPanel } from "./layout/SettingsPanel";
import { DirectoryPanel } from "./navigation/DirectoryPanel";
import { ProductPanel } from "./products/ProductPanel";
import { CartDrawer } from "./shopping/CartDrawer";
import { StoreCatalog } from "./stores/StoreCatalog";
import { Button } from "./ui/primitives";

/** The whole three.js engine lives in this chunk; it is only fetched on the client. */
const MallCanvas = dynamic(
  () => {
    useExperienceStore.getState().setLoading(0.05, "Loading the 3D engine");
    return import("@/three/scenes/MallCanvas").then((m) => {
      useExperienceStore.getState().setLoading(0.15, "Preparing materials");
      return m.default;
    });
  },
  { ssr: false, loading: () => null },
);

type Support = "checking" | "ok" | "unsupported";

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Shown when WebGL is unavailable or lost: the mall stays fully shoppable without 3D. */
function NoWebGL({ lost }: { lost: boolean }) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0f0d0a] px-6 py-16">
      <div className="mx-auto max-w-xl">
        <MonitorX size={32} className="text-bronze" aria-hidden />
        <h2 className="mt-4 font-display text-4xl text-ivory">{lost ? "The 3D view stopped" : "3D isn’t available here"}</h2>
        <p className="mt-3 text-muted">
          {lost
            ? "Your graphics driver reset the 3D view. Reloading usually brings it back. You can keep shopping from the directory meanwhile."
            : "This browser or device can’t display WebGL. You can still visit every store and shop their full catalogues below."}
        </p>
        {lost && (
          <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
            Reload the mall
          </Button>
        )}
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {STORES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => useExperienceStore.getState().browseStore(s.id)}
                className="flex w-full items-center gap-3 rounded-[12px] border border-line bg-ink p-4 text-left hover:border-line-strong"
              >
                <Store size={18} style={{ color: s.theme.accent }} aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-ivory">{s.name}</span>
                  <span className="block text-xs text-muted">{s.categoryLabel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Button className="mt-6" onClick={() => useExperienceStore.getState().openPanel("cart")}>
          View bag
        </Button>
      </div>
    </div>
  );
}

export function MallExperience() {
  const [hydrated, setHydrated] = useState(false);
  const [support, setSupport] = useState<Support>("checking");
  const phase = useExperienceStore((s) => s.phase);
  const webglLost = useExperienceStore((s) => s.webglLost);
  const motion = useSettingsStore((s) => s.motion);

  // Restore persisted settings and cart after mount (avoids SSR hydration mismatches).
  useEffect(() => {
    installDebugHook();
    void Promise.all([useSettingsStore.persist.rehydrate(), useCartStore.persist.rehydrate(), useAvatarStore.persist.rehydrate()]).finally(() => {
      const settings = useSettingsStore.getState();
      if (!settings.qualityChosen) settings.setQuality(detectQuality(), false);
      // Feature detection must run in the browser, after hydration.
      setSupport(detectWebGL() ? "ok" : "unsupported");
      setHydrated(true);
      // Live presence only when a realtime server is configured; otherwise the HUD says "solo".
      if (REALTIME_URL) connectPresence();
    });
    return () => {
      audio.dispose();
      disconnectPresence();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motion = motion;
  }, [motion]);

  const showWorldUI = support === "ok" && !webglLost;
  const inMall = phase === "explore" || phase === "inspect";

  return (
    <>
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          useExperienceStore.getState().openPanel("directory");
        }}
        className="sr-only z-[60] rounded-md bg-ivory px-4 py-2 text-sm font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip the 3D tour: open the store directory
      </a>

      {hydrated && showWorldUI && <MallCanvas />}
      {(support === "unsupported" || webglLost) && <NoWebGL lost={webglLost} />}

      {showWorldUI && (
        <>
          <IntroOverlay />
          {inMall && <HUD />}
          <ProductPanel />
          <AvatarPicker />
          <AssistantPanel />
        </>
      )}
      {support !== "unsupported" && !webglLost && <LoadingScreen />}
      <DirectoryPanel />
      <CartDrawer />
      <SettingsPanel />
      <HelpPanel />
      <StoreCatalog />
      <Toast />
    </>
  );
}
