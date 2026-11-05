/* Player Extras - Stash plugin (UI only).
   Each feature can be switched off in Settings → Plugins → Player Extras. */
(async function () {
  "use strict";
  let cfg = {};
  try {
    const r = await fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{configuration{plugins}}" }) });
    cfg = ((await r.json()).data.configuration.plugins || {})["player-extras"] || {};
  } catch (e) {}
  const on = (k) => !cfg[k];

  /* ---------- 1. Details-panel button ---------- */
  if (on("disablePanelButton")) (function () {
    function addBtn() {
      const bar = document.querySelector(".scene-player-container .vjs-control-bar");
      if (!bar || bar.querySelector(".xp-panel-btn")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vjs-control vjs-button xp-panel-btn";
      b.title = "Show/hide details panel";
      b.style.cssText = "font-size:1.6em;cursor:pointer;width:2.5em;";
      b.textContent = "☰";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const d = document.querySelector(".scene-divider button");
        if (d) d.click();
      });
      bar.insertBefore(b, bar.querySelector(".vjs-fullscreen-control"));
    }
    new MutationObserver(addBtn).observe(document.body, { childList: true, subtree: true });
    addBtn();
  })();

  /* ---------- 2. Motion heatmap ---------- */
  if (on("disableHeatmap")) (function () {
    let cur = null, busy = false;
    async function gql(query, variables) {
      const r = await fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
      return (await r.json()).data;
    }
    function tsec(t) {
      const p = t.trim().split(":").map(Number);
      return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
    }
    async function build(id) {
      const d = await gql("query($id:ID!){findScene(id:$id){paths{sprite vtt} files{duration}}}", { id });
      const sc = d && d.findScene;
      if (!sc || !sc.paths.sprite || !sc.paths.vtt) return null;
      const vtt = await (await fetch(sc.paths.vtt)).text();
      const cues = [];
      const re = /([\d:.]+)\s*-->\s*([\d:.]+)\s*\n[^\n]*#xywh=(\d+),(\d+),(\d+),(\d+)/g;
      let m;
      while ((m = re.exec(vtt))) cues.push({ s: tsec(m[1]), e: tsec(m[2]), x: +m[3], y: +m[4], w: +m[5], h: +m[6] });
      if (cues.length < 3) return null;
      const img = new Image();
      img.src = sc.paths.sprite;
      await img.decode();
      const W = 32, H = 18, c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      let prev = null;
      const vals = [];
      for (const q of cues) {
        ctx.drawImage(img, q.x, q.y, q.w, q.h, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const g = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) g[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
        let v = 0;
        if (prev) { for (let i = 0; i < g.length; i++) v += Math.abs(g[i] - prev[i]); v /= g.length; }
        prev = g;
        vals.push(v);
      }
      vals[0] = vals[1] || 0;
      const sm = vals.map((v, i) => { let s = 0, n = 0; for (let k = -1; k <= 1; k++) if (vals[i + k] != null) { s += vals[i + k]; n++; } return s / n; });
      const so = [...sm].sort((a, b) => a - b);
      const hi = so[Math.floor(so.length * 0.95)] || 1, lo = so[Math.floor(so.length * 0.1)] || 0;
      const dur = (sc.files[0] && sc.files[0].duration) || cues[cues.length - 1].e;
      return { id, dur, segs: cues.map((q, i) => ({ s: q.s, e: q.e, v: Math.max(0, Math.min(1, (sm[i] - lo) / ((hi - lo) || 1))) })) };
    }
    function draw(holder, data) {
      let cv = holder.querySelector(".xp-heatmap");
      if (!cv) {
        cv = document.createElement("canvas");
        cv.className = "xp-heatmap";
        cv.style.cssText = "position:absolute;left:0;width:100%;bottom:100%;height:6px;margin-bottom:3px;pointer-events:none;border-radius:2px;";
        holder.appendChild(cv);
      }
      cv.dataset.sid = data.id;
      const w = 600;
      cv.width = w; cv.height = 1;
      const x = cv.getContext("2d");
      x.clearRect(0, 0, w, 1);
      for (const s of data.segs) {
        x.fillStyle = "hsla(" + (1 - s.v) * 240 + ",90%,50%," + (0.2 + 0.8 * s.v) + ")";
        const a = Math.floor((s.s / data.dur) * w), b = Math.ceil((s.e / data.dur) * w);
        x.fillRect(a, 0, Math.max(1, b - a), 1);
      }
    }
    async function tick() {
      const m = location.pathname.match(/^\/scenes\/(\d+)/);
      const holder = document.querySelector(".scene-player-container .vjs-progress-holder");
      if (!m || !holder) return;
      const ex = holder.querySelector(".xp-heatmap");
      if (ex && ex.dataset.sid === m[1]) return;
      if (!cur || cur.id !== m[1]) cur = { id: m[1], p: build(m[1]).catch(() => null) };
      const data = await cur.p;
      const now = (location.pathname.match(/^\/scenes\/(\d+)/) || [])[1];
      const h = document.querySelector(".scene-player-container .vjs-progress-holder");
      if (data && h && now === data.id) draw(h, data);
    }
    new MutationObserver(() => { if (busy) return; busy = true; setTimeout(() => { busy = false; tick(); }, 500); })
      .observe(document.body, { childList: true, subtree: true });
  })();

  /* ---------- 3. Marker skip ---------- */
  if (on("disableMarkerSkip")) (function () {
    async function markers(id) {
      const r = await fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query($id:ID!){findScene(id:$id){scene_markers{seconds title primary_tag{name}}}}", variables: { id } }) });
      const d = (await r.json()).data;
      return ((d && d.findScene && d.findScene.scene_markers) || []).slice().sort((a, b) => a.seconds - b.seconds);
    }
    function toast(el, txt) {
      let t = el.querySelector(".xp-toast");
      if (!t) {
        t = document.createElement("div");
        t.className = "xp-toast";
        t.style.cssText = "position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.75);color:#fff;padding:4px 12px;border-radius:4px;font-size:15px;z-index:20;pointer-events:none;transition:opacity .3s";
        el.appendChild(t);
      }
      t.textContent = txt;
      t.style.opacity = 1;
      clearTimeout(t._h);
      t._h = setTimeout(() => (t.style.opacity = 0), 1500);
    }
    function fmt(s) {
      s = Math.floor(s);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
      return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + x;
    }
    async function jump(dir) {
      const m = location.pathname.match(/^\/scenes\/(\d+)/);
      const el = document.querySelector(".scene-player-container .video-js");
      if (!m || !el || !el.player) return;
      const p = el.player, t = p.currentTime(), ms = await markers(m[1]);
      if (!ms.length) { toast(el, "No markers in this scene"); return; }
      const tgt = dir > 0 ? ms.find((x) => x.seconds > t + 1) : [...ms].reverse().find((x) => x.seconds < t - 2);
      if (!tgt) { toast(el, dir > 0 ? "No more markers" : "No earlier markers"); return; }
      p.currentTime(tgt.seconds);
      toast(el, (tgt.title || tgt.primary_tag.name) + "  (" + (ms.indexOf(tgt) + 1) + "/" + ms.length + ", " + fmt(tgt.seconds) + ")");
    }
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const a = document.activeElement;
      if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
      if ((e.key === "[" || e.key === "]") && /^\/scenes\/\d+/.test(location.pathname)) {
        e.preventDefault(); e.stopPropagation();
        jump(e.key === "]" ? 1 : -1);
      }
    }, true);
    function addBtns() {
      const bar = document.querySelector(".scene-player-container .vjs-control-bar");
      if (!bar || bar.querySelector(".xp-mk-prev")) return;
      const mk = (cls, title, txt, dir) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vjs-control vjs-button " + cls;
        b.title = title;
        b.style.cssText = "font-size:1.8em;cursor:pointer;width:1.8em;";
        b.textContent = txt;
        b.addEventListener("click", (e) => { e.stopPropagation(); jump(dir); });
        return b;
      };
      const ref = bar.querySelector(".xp-panel-btn") || bar.querySelector(".vjs-fullscreen-control");
      bar.insertBefore(mk("xp-mk-prev", "Previous marker  [", "«", -1), ref);
      bar.insertBefore(mk("xp-mk-next", "Next marker  ]", "»", 1), ref);
    }
    new MutationObserver(addBtns).observe(document.body, { childList: true, subtree: true });
    addBtns();
  })();

  /* ---------- 4. Rating popup ---------- */
  if (on("disableRating")) (function () {
    async function gql(query, variables) {
      const r = await fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
      const j = await r.json();
      if (j.errors) throw new Error(j.errors[0].message);
      return j.data;
    }
    const sid = () => (location.pathname.match(/^\/scenes\/(\d+)/) || [])[1];
    // Build the choices from the user's rating system (Settings → Interface → Editing).
    let scale = null;
    async function getScale() {
      if (scale) return scale;
      let o = {};
      try { o = (await gql("{configuration{ui}}")).configuration.ui.ratingSystemOptions || {}; } catch (e) {}
      if (o.type === "stars" && (o.starPrecision || "full") === "full")
        scale = { cols: 5, opts: [1, 2, 3, 4, 5].map((n) => ({ label: n + "★", v: n * 20 })), show: (r) => r / 20 };
      else if (o.type === "stars")
        scale = { cols: 5, opts: [...Array(10)].map((_, i) => ({ label: String((i + 1) / 2), v: (i + 1) * 10 })), show: (r) => Math.round(r / 10) / 2 };
      else
        scale = { cols: 5, opts: [...Array(10)].map((_, i) => ({ label: String(i + 1), v: (i + 1) * 10 })), show: (r) => Math.round(r / 10) };
      return scale;
    }
    function label(b, r, s) {
      b.textContent = r ? "★" + s.show(r) : "☆";
      b.title = r ? "Rating " + s.show(r) + " - click to change" : "Rate this scene";
    }
    async function refresh(b) {
      const id = sid();
      if (!id) return;
      try {
        const s = await getScale();
        const d = await gql("query($id:ID!){findScene(id:$id){rating100}}", { id });
        b._r = d.findScene.rating100;
        label(b, b._r, s);
        b.dataset.sid = id;
      } catch (e) {}
    }
    function close() { const m = document.querySelector(".xp-rate-menu"); if (m) m.remove(); }
    async function open(b) {
      close();
      const s = await getScale();
      const m = document.createElement("div");
      m.className = "xp-rate-menu";
      m.style.cssText = "position:absolute;bottom:3.2em;right:0;background:rgba(20,20,20,.95);border:1px solid #444;border-radius:6px;padding:8px;z-index:30;display:grid;grid-template-columns:repeat(" + s.cols + ",2.4em);gap:5px;font-size:13px;";
      const head = document.createElement("div");
      head.textContent = "Rate scene";
      head.style.cssText = "grid-column:1/-1;color:#ccc;text-align:center;margin-bottom:2px";
      m.appendChild(head);
      const set = async (v) => {
        try {
          await gql("mutation($id:ID!,$r:Int){sceneUpdate(input:{id:$id,rating100:$r}){rating100}}", { id: sid(), r: v });
          b._r = v;
          label(b, v, s);
        } catch (e) { alert("Rating failed: " + e.message); }
        close();
      };
      s.opts.forEach((o, i) => {
        const x = document.createElement("button");
        x.type = "button";
        x.textContent = o.label;
        const on = b._r === o.v;
        x.style.cssText = "height:2.2em;border:0;border-radius:4px;cursor:pointer;font-weight:bold;color:" + (on ? "#000" : "#fff") + ";background:" + (on ? "#f5c518" : "hsl(" + Math.round(((i + 1) / s.opts.length) * 120) + ",55%,32%)");
        x.addEventListener("click", (e) => { e.stopPropagation(); set(o.v); });
        m.appendChild(x);
      });
      const c = document.createElement("button");
      c.type = "button";
      c.textContent = "Clear rating";
      c.style.cssText = "grid-column:1/-1;border:0;border-radius:4px;background:#555;color:#fff;cursor:pointer;height:2em;margin-top:2px";
      c.addEventListener("click", (e) => { e.stopPropagation(); set(null); });
      m.appendChild(c);
      m.addEventListener("click", (e) => e.stopPropagation());
      b._wrap.appendChild(m);
    }
    document.addEventListener("click", (e) => { if (!e.target.closest || !e.target.closest(".xp-rate-wrap")) close(); }, true);
    function addBtn() {
      const bar = document.querySelector(".scene-player-container .vjs-control-bar");
      if (!bar) return;
      let b = bar.querySelector(".xp-rate-btn");
      if (b) {
        if (b.dataset.sid !== sid() && !b._busy) { b._busy = true; refresh(b).finally(() => (b._busy = false)); }
        return;
      }
      const wrap = document.createElement("div");
      wrap.className = "xp-rate-wrap vjs-control";
      wrap.style.cssText = "position:relative;width:2.6em;";
      b = document.createElement("button");
      b.type = "button";
      b.className = "vjs-button xp-rate-btn";
      b.style.cssText = "font-size:1.5em;cursor:pointer;width:100%;height:100%;color:#f5c518;";
      b._wrap = wrap;
      b.textContent = "☆";
      b.addEventListener("click", (e) => { e.stopPropagation(); if (document.querySelector(".xp-rate-menu")) close(); else open(b); });
      wrap.appendChild(b);
      const ref = bar.querySelector(".xp-mk-prev") || bar.querySelector(".xp-panel-btn") || bar.querySelector(".vjs-fullscreen-control");
      bar.insertBefore(wrap, ref);
      b._busy = true;
      refresh(b).finally(() => (b._busy = false));
    }
    new MutationObserver(addBtn).observe(document.body, { childList: true, subtree: true });
    addBtn();
  })();

  /* ---------- 5. Task-queue button ---------- */
  if (on("disableQueueButton")) (function () {
    "use strict";
    async function gql(query, variables) {
      const r = await fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
      const j = await r.json();
      if (j.errors) throw new Error(j.errors[0].message);
      return j.data;
    }
    const getJobs = async () => (await gql("{jobQueue{id status description progress}}")).jobQueue || [];
    const stop = (id) => gql("mutation($id:ID!){stopJob(job_id:$id)}", { id });

    const btn = document.createElement("button");
    btn.style.cssText =
      "position:fixed;right:14px;bottom:14px;z-index:9999;display:none;padding:6px 12px;" +
      "border:0;border-radius:18px;background:#137cbd;color:#fff;font-size:13px;box-shadow:0 2px 8px #0008;cursor:pointer";
    const panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;right:14px;bottom:52px;z-index:9999;display:none;width:min(440px,92vw);max-height:60vh;" +
      "overflow:auto;background:#202b33;color:#eee;border:1px solid #394b59;border-radius:8px;padding:8px;font-size:13px;box-shadow:0 4px 16px #000a";
    document.body.append(btn, panel);

    const small = (txt, title, fn) => {
      const b = document.createElement("button");
      b.textContent = txt; b.title = title;
      b.style.cssText = "margin-left:4px;padding:2px 7px;border:0;border-radius:4px;background:#394b59;color:#fff;cursor:pointer";
      b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; try { await fn(); } catch (x) { alert(x.message); } refresh(true); };
      return b;
    };

    async function render(jobs) {
      panel.innerHTML = "";
      const head = document.createElement("div");
      head.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-weight:600";
      head.textContent = jobs.length + " task(s)";
      head.append(small("Clear all", "Cancel every task", async () => {
        if (!confirm("Cancel all " + jobs.length + " tasks?")) return;
        for (const j of jobs) await stop(j.id);
      }));
      panel.append(head);
      jobs.forEach((j, i) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 0;border-top:1px solid #394b59";
        const label = document.createElement("span");
        label.style.flex = "1";
        const pct = j.progress != null && j.status === "RUNNING" ? " " + Math.round(j.progress * 100) + "%" : "";
        label.textContent = (j.status === "RUNNING" ? "▶ " : i + 1 + ". ") + j.description + pct;
        row.append(label);
        if (j.status !== "RUNNING" && i > 0) {
          row.append(small("⏭ next", "Cancel the tasks waiting in front of this one (the running task keeps going)", async () => {
            const ahead = jobs.slice(0, i).filter((x) => x.status !== "RUNNING");
            if (ahead.length && !confirm("Cancel " + ahead.length + " waiting task(s) in front of this one?")) return;
            for (const x of ahead) await stop(x.id);
          }));
        }
        row.append(small("✖", "Cancel this task", () => stop(j.id)));
        panel.append(row);
      });
    }

    let last = "";
    async function refresh(force) {
      let jobs = [];
      try { jobs = await getJobs(); } catch (e) { return; }
      btn.style.display = jobs.length ? "block" : "none";
      btn.textContent = "⚙ Queue: " + jobs.length;
      if (!jobs.length) panel.style.display = "none";
      const sig = JSON.stringify(jobs.map((j) => [j.id, j.status, Math.round((j.progress || 0) * 100)]));
      if (force || sig !== last) { last = sig; if (panel.style.display === "block") render(jobs); }
    }
    btn.onclick = async () => {
      panel.style.display = panel.style.display === "block" ? "none" : "block";
      if (panel.style.display === "block") render(await getJobs());
    };
    setInterval(refresh, 3000);
    refresh();
  })();

  /* ---------- 6. VR zoom ---------- */
  if (on("disableVrZoom")) (function () {
    "use strict";
    window.addEventListener("wheel", function (e) {
      const el = e.target && e.target.closest && e.target.closest(".video-js");
      if (!el || !el.player) return;
      const p = el.player;
      if (!(p.usingPlugin && p.usingPlugin("vr"))) return;
      const vr = p.vr();
      if (!vr || !vr.camera || !vr.currentProjection_ || vr.currentProjection_ === "NONE") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const c = vr.camera;
      c.fov = Math.min(110, Math.max(20, c.fov + (e.deltaY > 0 ? 5 : -5)));
      c.updateProjectionMatrix();
    }, { capture: true, passive: false });
  })();

  /* ---------- 7. Scroll memory ---------- */
  if (on("disableScrollMemory")) (function () {
    "use strict";
    const KEY = "xp-scroll:";
    const key = () => KEY + location.pathname + location.search;
    const isPlayer = () => /^\/scenes\/\d+/.test(location.pathname);
    const store = {
      get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
      set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    };
    let restoring = false;
    function save() {
      if (!restoring && !isPlayer()) store.set(key(), String(Math.round(window.scrollY)));
    }
    function restore() {
      if (isPlayer()) return;
      const y = parseInt(store.get(key()) || "0", 10);
      if (!y) return;
      restoring = true;
      const start = Date.now();
      let hits = 0;
      (function tick() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max >= y - 5) {
          if (Math.abs(window.scrollY - y) > 5) window.scrollTo(0, y);
          hits++;
        }
        if (hits < 8 && Date.now() - start < 6000) setTimeout(tick, 120);
        else restoring = false;
      })();
    }
    let t = null;
    window.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(save, 150); }, { passive: true });
    document.addEventListener("click", save, true);
    window.addEventListener("popstate", () => setTimeout(restore, 50));
  })();
})();
