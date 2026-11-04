// The fixed footer. Injected into every page at build time and kept outside src/,
// so the agent can't edit or remove it. It re-attaches itself if something removes it.
(() => {
  const CONTROL = "https://queue.unsupervised.website";
  const HOST_ID = "unsupervised-footer";

  function build() {
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute(
      "style",
      [
        "all: initial !important",
        "position: fixed !important",
        "left: 0 !important",
        "right: 0 !important",
        "bottom: 0 !important",
        "z-index: 2147483647 !important",
        "display: block !important",
        "visibility: visible !important",
        "opacity: 1 !important",
        "transform: none !important",
        "pointer-events: auto !important",
      ].join(";"),
    );
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        .bar { font: 600 13px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif; background: #111; color: #fff;
          display: flex; gap: 14px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 8px 16px; }
        a { color: #fff; }
        .cta { background: #e5484d; color: #fff; padding: 4px 10px; border-radius: 6px; text-decoration: none; }
        .muted { color: #aaa; font-weight: 400; }
      </style>
      <div class="bar">
        <span>This website is unsupervised.</span>
        <a class="cta" href="${CONTROL}/">Change it</a>
        <span class="muted" id="status"></span>
        <a href="${CONTROL}/changelog">Changelog</a>
        <a href="${CONTROL}/terms">Terms</a>
      </div>`;
    fetch(`${CONTROL}/api/status`)
      .then((r) => r.json())
      .then((s) => {
        root.getElementById("status").textContent = s.open
          ? `${s.cap - s.accepted} of ${s.cap} spots left this window`
          : "Window full, reopens soon";
      })
      .catch(() => {});
    return host;
  }

  let host = build();
  const attach = () => {
    if (!host.isConnected) document.documentElement.appendChild(host);
  };
  attach();
  new MutationObserver(() => {
    if (!host.isConnected) {
      host = build();
      attach();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
