import { createRoot, type Root } from "react-dom/client";
import { LiquidGlass } from "./ui/liquid-glass";

const selector = ".command-nav, .dashboard-hero, .panel, .stat, .glass-widget";
const surfaces = new Map<Element, { host: HTMLDivElement; root: Root }>();

function syncSurfaces() {
  const current = new Set(document.querySelectorAll(selector));
  for (const [surface, { host, root }] of surfaces) {
    if (current.has(surface)) continue;
    root.unmount();
    host.remove();
    surfaces.delete(surface);
  }
  for (const surface of current) {
    if (surfaces.has(surface)) continue;
    const host = document.createElement("div");
    host.className = "dashboard-liquid-layer";
    host.setAttribute("aria-hidden", "true");
    surface.prepend(host);
    const root = createRoot(host);
    surfaces.set(surface, { host, root });
    root.render(
      <LiquidGlass
        className="dashboard-liquid-surface"
        radius={parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0}
        bevelDepth={12}
        scale={20}
        aberration={2}
        tint={0.045}
      />,
    );
  }
}

new MutationObserver(syncSurfaces).observe(document.querySelector("#main")!, {
  childList: true,
  subtree: true,
});
syncSurfaces();
