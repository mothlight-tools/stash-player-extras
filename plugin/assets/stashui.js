// Player Extras - Stash UI extension: « » previous/next marker buttons and the [ ] keys in Stash UI's
// player. (Stash UI already has its own heatmap, rating, details panel and VR mode.)
// Loaded by Stash UI from /plugin/player-extras/assets/stashui.js.
const PLUGIN_ID = "player-extras";

async function gql(query, variables) {
  const r = await fetch("/graphql", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

async function settings() {
  const d = await gql("{configuration{plugins}}");
  return (d.configuration.plugins || {})[PLUGIN_ID] || {};
}

const fmt = (s) => {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`;
};

function flash(video, txt) {
  const host = (video && video.parentElement) || document.body;
  let t = host.querySelector(":scope > .px-flash");
  if (!t) {
    t = document.createElement("div");
    t.className = "px-flash";
    t.style.cssText =
      "position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;" +
      "padding:6px 14px;border-radius:6px;font-size:15px;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap";
    host.appendChild(t);
  }
  t.textContent = txt;
  t.style.opacity = 1;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.opacity = 0), 2200);
}

const iconBtn = (txt, title) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "kb-btn is-icon is-ghost px-btn";
  b.textContent = txt;
  b.title = title;
  b.style.cssText = "font-size:16px;line-height:1;font-weight:bold;";
  return b;
};

// ☰ - opens/closes Stash UI's own details panel (same as its ⓘ button / the I key).
// Its tooltip shows the studio, title and performers, so you can see what's playing without opening the panel.
function panelBtn(ctx, isAlive) {
  const b = iconBtn("☰", "Details panel on/off  (I)");
  if (ctx && ctx.id != null)
    gql("query($id:ID!){findScene(id:$id){title date studio{name} performers{name}}}", { id: ctx.id })
      .then((d) => {
        const s = d.findScene;
        if (!s || (isAlive && !isAlive())) return;
        const who = (s.performers || []).map((p) => p.name).join(", ");
        b.title = [[s.studio && s.studio.name, s.date].filter(Boolean).join("  ·  "), s.title, who, "", "Details panel on/off  (I)"]
          .filter((x, i) => x || i === 3).join("\n").replace(/^\n+/, "");
      }).catch(() => {});
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const t = Array.from(document.querySelectorAll("button")).find((x) => /^Details on\/off/.test(x.title || ""));
    if (t) t.click();
    else document.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
  });
  return b;
}

// ☆ - quick rating popup, using the rating system set in Stash (Settings → Interface → Editing).
let scale = null;
async function getScale() {
  if (scale) return scale;
  let o = {};
  try { o = (await gql("{configuration{ui}}")).configuration.ui.ratingSystemOptions || {}; } catch (e) {}
  if (o.type === "stars" && (o.starPrecision || "full") === "full")
    scale = { opts: [1, 2, 3, 4, 5].map((n) => ({ label: n + "★", v: n * 20 })), show: (r) => r / 20 };
  else if (o.type === "stars")
    scale = { opts: [...Array(10)].map((_, i) => ({ label: String((i + 1) / 2), v: (i + 1) * 10 })), show: (r) => Math.round(r / 10) / 2 };
  else
    scale = { opts: [...Array(10)].map((_, i) => ({ label: String(i + 1), v: (i + 1) * 10 })), show: (r) => Math.round(r / 10) };
  return scale;
}
function closeRate() {
  const m = document.querySelector(".px-rate-menu");
  if (m) m.remove();
}
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest || !e.target.closest(".px-rate-menu, .px-rate-btn")) closeRate();
}, true);

function rateBtn(ctx, isAlive) {
  const b = iconBtn("☆", "Rate this scene");
  b.classList.add("px-rate-btn");
  let rating = null;
  const label = (s) => {
    b.textContent = rating ? "★" + s.show(rating) : "☆";
    b.title = rating ? "Rating " + s.show(rating) + " - click to change" : "Rate this scene";
    b.style.color = rating ? "var(--pink, #ff3e8a)" : "";
  };
  Promise.all([getScale(), gql("query($id:ID!){findScene(id:$id){rating100}}", { id: ctx.id })])
    .then(([s, d]) => { if (!isAlive()) return; rating = d.findScene && d.findScene.rating100; label(s); })
    .catch(() => {});
  b.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.querySelector(".px-rate-menu")) return closeRate();
    const s = await getScale();
    const r = b.getBoundingClientRect();
    // Built from Stash UI's own menu classes (kb-pmenu), so it follows its look and theme.
    const m = document.createElement("div");
    m.className = "kb-pmenu px-rate-menu";
    m.style.cssText = "position:fixed;z-index:99999;width:auto;min-width:0;max-height:none;right:auto;bottom:auto;";
    const sec = document.createElement("div");
    sec.className = "kb-pmenu-sec";
    const head = document.createElement("b");
    head.textContent = "Rating";
    sec.appendChild(head);
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(5,minmax(2.5em,1fr));gap:2px;padding:2px 2px 4px";
    sec.appendChild(grid);
    m.appendChild(sec);
    const set = async (v) => {
      try {
        await gql("mutation($id:ID!,$r:Int){sceneUpdate(input:{id:$id,rating100:$r}){rating100}}", { id: ctx.id, r: v });
        rating = v;
        label(s);
        flash(ctx.video, v ? "Rated " + s.show(v) : "Rating cleared");
      } catch (err) { alert("Rating failed: " + err.message); }
      closeRate();
    };
    s.opts.forEach((o) => {
      const x = document.createElement("button");
      x.type = "button";
      const on = rating === o.v;
      x.className = "kb-pmenu-opt" + (on ? " is-on" : "");
      x.textContent = o.label;
      x.style.cssText = "justify-content:center;text-align:center;font-variant-numeric:tabular-nums;" +
        (on ? "background:color-mix(in srgb,var(--pink,#ff3e8a) 18%,transparent);" : "");
      x.addEventListener("click", (ev) => { ev.stopPropagation(); set(o.v); });
      grid.appendChild(x);
    });
    const c = document.createElement("button");
    c.type = "button";
    c.className = "kb-pmenu-opt";
    c.textContent = "Clear rating";
    c.style.cssText = "width:100%;justify-content:center;color:var(--faint,#a07a96);border-top:1px solid rgba(255,255,255,.1);border-radius:0 0 12px 12px;margin-top:2px";
    c.addEventListener("click", (ev) => { ev.stopPropagation(); set(null); });
    sec.appendChild(c);
    ["click", "keydown", "dblclick"].forEach((t) => m.addEventListener(t, (ev) => ev.stopPropagation()));
    document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    m.style.top = Math.max(8, r.top - h - 8) + "px";
  });
  return b;
}

// Studio and performers next to the scene title in the player's top bar (Stash UI only shows the title there).
function topInfo(ctx, isAlive) {
  let span = null;
  gql("query($id:ID!){findScene(id:$id){studio{name} performers{name}}}", { id: ctx.id }).then(async (d) => {
    const s = d.findScene;
    if (!s || !isAlive()) return;
    const bits = [s.studio && s.studio.name, (s.performers || []).map((p) => p.name).join(", ")].filter(Boolean);
    if (!bits.length) return;
    let title = null;
    for (let i = 0; i < 30 && isAlive() && !(title = document.querySelector(".kb-topbar-title")); i++) await new Promise((r) => setTimeout(r, 100));
    if (!title || !isAlive()) return;
    title.querySelectorAll(".px-topinfo").forEach((x) => x.remove());
    span = document.createElement("span");
    span.className = "px-topinfo";
    span.textContent = bits.join("  ·  ");
    span.title = bits.join("\n");
    span.style.cssText = "margin-left:.7em;font-weight:500;font-size:.8em;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    title.appendChild(span);
  }).catch(() => {});
  return () => { if (span) span.remove(); };
}

// Full screen when you click the player (setting "Full screen when you click the player"). Stash UI's own
// player: the first click on the video or its controls; DirtyMultiscreen / classic scene pages inside the
// Classic Stash frame are handled by the classic part of the plugin, which makes this whole page full screen.
// Here we end it when you leave the player, and remember an Esc until then.
const fsState = { mounted: 0, on: null };
const embeddedPlayer = () => {
  let h = location.hash;
  try { h = decodeURIComponent(h); } catch (e) {}
  return /extern\/classic\?path=\/(plugins\/multiscreen|scenes\/\d)/.test(h);
};
function fsLeaveIfDone() {
  setTimeout(() => {
    if (fsState.mounted > 0 || embeddedPlayer()) return;
    window.__pxFsOff = false;
    if (window.__pxFs && document.fullscreenElement) { window.__pxFsLeaving = true; document.exitFullscreen().catch(() => {}); }
  }, 700);   // the next scene's player mounts within this time when you skip to it
}
function fsSetup() {
  if (fsState.on) return fsState.on;
  fsState.on = settings().then((s) => {
    if (!s.enableAutoFullscreen) return false;
    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement || !window.__pxFs) return;
      window.__pxFs = false;
      if (window.__pxFsLeaving) window.__pxFsLeaving = false; else window.__pxFsOff = true;   // you pressed Esc
    });
    window.addEventListener("hashchange", fsLeaveIfDone);
    return true;
  }).catch(() => false);
  return fsState.on;
}
function fsWatch(el, ctx, isAlive) {
  let root = null, onClick = null;
  fsSetup().then((on) => {
    if (!on || !isAlive()) return;
    root = el;
    while (root && ctx.video && !root.contains(ctx.video)) root = root.parentElement;
    if (!root) return;
    onClick = () => {
      if (document.fullscreenElement || window.__pxFsOff) return;
      document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => { window.__pxFs = true; }).catch(() => {});
    };
    root.addEventListener("click", onClick, true);
  });
  fsState.mounted++;
  return () => {
    fsState.mounted--;
    if (root && onClick) root.removeEventListener("click", onClick, true);
    fsLeaveIfDone();
  };
}

export default function setup(stashui) {
  fsSetup();
  if (stashui.has && !stashui.has("slot:player.controls")) return;
  stashui.addSlot("player.controls", {
    id: "player-extras-markers",
    title: "Player Extras",
    match: (ctx) => ctx.kind === "scene",
    mount(el, ctx) {
      let alive = true, markers = null, onKey = null, dropTop = null;
      const dropFs = fsWatch(el, ctx, () => alive);
      const load = async () => {
        if (!markers) {
          const d = await gql("query($id:ID!){findScene(id:$id){scene_markers{seconds title primary_tag{name}}}}", { id: ctx.id });
          markers = ((d.findScene && d.findScene.scene_markers) || []).slice().sort((a, b) => a.seconds - b.seconds);
        }
        return markers;
      };
      const jump = async (dir) => {
        const v = ctx.video;
        if (!v) return;
        const ms = await load();
        if (!ms.length) return flash(v, "No markers in this scene");
        const now = v.currentTime;
        let i = -1;
        if (dir > 0) i = ms.findIndex((m) => m.seconds > now + 0.5);
        else for (let k = ms.length - 1; k >= 0; k--) if (ms[k].seconds < now - 2) { i = k; break; }
        if (i < 0) return flash(v, dir > 0 ? "No more markers" : "At the first marker");
        const m = ms[i];
        v.currentTime = m.seconds;
        flash(v, `${m.title || (m.primary_tag && m.primary_tag.name) || "Marker"}  ·  ${i + 1}/${ms.length}  ·  ${fmt(m.seconds)}`);
      };
      const btn = (txt, title, dir) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kb-btn is-icon is-ghost px-btn";
        b.textContent = txt;
        b.title = title;
        b.style.cssText = "font-size:17px;line-height:1;font-weight:bold;";
        b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); jump(dir); });
        return b;
      };
      settings().then((s) => {
        if (!alive) return;
        if (!s.disableTopbarInfo) dropTop = topInfo(ctx, () => alive);
        if (!s.disablePanelButton) el.append(panelBtn(ctx, () => alive));
        if (!s.disableRating) el.append(rateBtn(ctx, () => alive));
        if (s.disableMarkerSkip) return;
        el.append(btn("«", "Previous marker  [", -1), btn("»", "Next marker  ]", 1));
        onKey = (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey || (e.key !== "[" && e.key !== "]")) return;
          const t = e.target;
          if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
          e.preventDefault();
          e.stopPropagation();
          jump(e.key === "]" ? 1 : -1);
        };
        document.addEventListener("keydown", onKey, true);
      }).catch(() => {});
      return () => {
        alive = false;
        dropFs();
        if (dropTop) dropTop();
        if (onKey) document.removeEventListener("keydown", onKey, true);
        closeRate();
        el.innerHTML = "";
      };
    },
  });
}
