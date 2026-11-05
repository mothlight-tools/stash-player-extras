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
function panelBtn() {
  const b = iconBtn("☰", "Details panel on/off  (I)");
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

export default function setup(stashui) {
  if (stashui.has && !stashui.has("slot:player.controls")) return;
  stashui.addSlot("player.controls", {
    id: "player-extras-markers",
    title: "Player Extras",
    match: (ctx) => ctx.kind === "scene",
    mount(el, ctx) {
      let alive = true, markers = null, onKey = null;
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
        if (!s.disablePanelButton) el.append(panelBtn());
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
        if (onKey) document.removeEventListener("keydown", onKey, true);
        closeRate();
        el.innerHTML = "";
      };
    },
  });
}
