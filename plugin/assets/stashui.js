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

export default function setup(stashui) {
  if (stashui.has && !stashui.has("slot:player.controls")) return;
  stashui.addSlot("player.controls", {
    id: "player-extras-markers",
    title: "Player Extras: marker skip",
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
        if (!alive || s.disableMarkerSkip) return;
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
        el.innerHTML = "";
      };
    },
  });
}
