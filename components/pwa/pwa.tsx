"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, X, Plus } from "lucide-react";

// Registers the service worker and renders a tasteful mobile install prompt.
// Two paths:
//  - Chromium (Android/desktop): capture `beforeinstallprompt`, show a banner
//    with a real Install button that fires the native prompt.
//  - iOS Safari (no beforeinstallprompt): show Add-to-Home-Screen instructions.
// Dismissal is remembered for 30 days; never shown once already installed.

const DISMISS_KEY = "favor-pwa-dismissed-until";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
}

function dismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || "0");
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function Pwa() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration is best-effort */
      });
    }

    if (isStandalone() || dismissedRecently()) return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS never fires beforeinstallprompt; show the manual hint on iOS Safari.
    if (isIos()) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 1200);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBip);
        clearTimeout(t);
      };
    }

    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setShow(false);
    else dismiss();
    setDeferred(null);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl border border-[#e5e0d6] bg-white p-4 shadow-[0_18px_50px_-20px_rgba(31,58,26,0.45)]">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFFEF9] ring-1 ring-[#e5e0d6]">
            <Image src="/icons/icon-192.png" alt="Favor" width={44} height={44} className="h-11 w-11" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-[#1a1a1a]">Install the Favor app</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6f7766]">
              {iosHint
                ? "Add it to your Home Screen for one-tap access to your giving. It is safe and secure."
                : "One tap to your giving from your home screen. Safe, secure, no app store."}
            </p>

            {iosHint ? (
              <p className="mt-2 flex flex-wrap items-center gap-1 text-xs font-medium text-[#2b4d24]">
                Tap
                <Share className="mx-0.5 inline h-3.5 w-3.5" aria-hidden="true" />
                then
                <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-[#2b4d24]/8 px-1.5 py-0.5">
                  <Plus className="h-3 w-3" aria-hidden="true" /> Add to Home Screen
                </span>
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={install}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2b4d24] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#24401e]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Install app
                </button>
                <button onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#6f7766] hover:text-[#1a1a1a]">
                  Not now
                </button>
              </div>
            )}
          </div>
          <button onClick={dismiss} aria-label="Dismiss" className="-mr-1 -mt-1 rounded-md p-1 text-[#a8b0a0] hover:text-[#1a1a1a]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
