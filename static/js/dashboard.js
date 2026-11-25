(function () {
  const root = document.getElementById("dash");
  const OUTCOME = {
    verified: { label: "Verified", color: "#0c8f6f", badge: "ok" },
    unknown: { label: "Not recognised", color: "#a8700f", badge: "warn" },
    rejected_spoof: { label: "Spoof rejected", color: "#c0352b", badge: "bad" },
    rejected_deepfake: { label: "Manipulation rejected", color: "#7a3fd1", badge: "bad" },
    no_face: { label: "No face found", color: "#7a879c", badge: "" },
    enrolled: { label: "Registered", color: "#2f5bff", badge: "" },
    deleted: { label: "Removed", color: "#7a879c", badge: "" },
  };
  const TASK = {
    facecheck: "Face check",
    liveness: "Liveness",
    deepfake: "Deepfake screen",
  };
  const pct = (v) => (v === null || v === undefined ? "–" : (v * 100).toFixed(1) + "%");

  function activityBars(series) {
    const max = Math.max(1, ...series.map((d) => d.count));
    const W = 560, H = 180, pad = 26, bw = (W - pad * 2) / series.length;
    const bars = series.map((d, i) => {
      const h = Math.max(d.count ? 4 : 1, ((H - 50) * d.count) / max);
      const x = pad + i * bw + bw * 0.18;
      const day = new Date(d.day + "T00:00:00Z").toLocaleDateString([], { weekday: "short", timeZone: "UTC" });
      return `<rect x="${x}" y="${H - 28 - h}" width="${bw * 0.64}" height="${h}" rx="5" fill="${d.count ? "#2f5bff" : "#c9d3de"}"><title>${day}: ${d.count} checks</title></rect>
        <text x="${x + bw * 0.32}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#4a5873">${day}</text>
        ${d.count ? `<text x="${x + bw * 0.32}" y="${H - 34 - h}" text-anchor="middle" font-size="12" font-weight="700" fill="#14213d">${d.count}</text>` : ""}`;
    }).join("");
    return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verifications per day for the last 7 days">${bars}</svg>`;
  }

  function outcomes(by) {
    const keys = Object.keys(by).filter((k) => by[k] > 0);
    const total = keys.reduce((s, k) => s + by[k], 0);
    if (!total) return '<p class="empty-note">No verifications yet. Run a check on the Verify page and the outcomes appear here.</p>';
    const segs = keys.map((k) => `<span title="${(OUTCOME[k] || {}).label || k}: ${by[k]}" style="width:${(by[k] / total) * 100}%;background:${(OUTCOME[k] || {}).color || "#7a879c"}"></span>`).join("");
    const rows = keys.map((k) => `<li><i style="background:${(OUTCOME[k] || {}).color || "#7a879c"}"></i>${TF.escape((OUTCOME[k] || {}).label || k)}<span class="v">${by[k]}</span></li>`).join("");
    return `<div class="stack" role="img" aria-label="Outcome split">${segs}</div><ul class="legend">${rows}</ul>`;
  }

  function metricsTable(m) {
    if (!m) return '<p class="empty-note">No training metrics found. Run <code>python scripts/train_all.py</code>.</p>';
    const rows = Object.entries(m.tasks).map(([k, t]) => `
      <tr>
        <td>${TF.escape(TASK[k] || k)} ${t.synthetic_attacks ? '<span class="badge warn">simulated attacks</span>' : '<span class="badge ok">real data</span>'}</td>
        <td class="num">${pct(t.accuracy)}</td>
        <td class="num">${pct(t.roc_auc)}</td>
        <td class="num">${pct(t.far)}</td>
        <td class="num">${pct(t.frr)}</td>
        <td class="num">${pct(t.cv_accuracy_mean)}</td>
      </tr>`).join("");
    return `<div class="table-wrap"><table>
      <thead><tr><th>Model</th><th class="num">Accuracy</th><th class="num">AUC</th><th class="num">False accept</th><th class="num">False reject</th><th class="num">5-fold CV</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      <p class="meta-line">Hold-out test on faces the model never saw (split by person). Trained ${TF.escape(m.trained_at)}. False accept is the share of attacks let through; false reject is the share of real faces blocked.</p>`;
  }

  function logTable(logs) {
    if (!logs.length) return '<p class="empty-note">No activity yet.</p>';
    const rows = logs.map((l) => {
      const o = OUTCOME[l.decision] || { label: l.decision || l.event, badge: "" };
      return `<tr>
        <td>${TF.escape(TF.fmtDate(l.created_at))}</td>
        <td><span class="badge ${o.badge}">${TF.escape(o.label)}</span></td>
        <td>${TF.escape(l.user_name || "–")}</td>
        <td class="num">${l.liveness_score == null ? "–" : Math.round(l.liveness_score * 100) + "%"}</td>
        <td class="num">${l.latency_ms == null ? "–" : l.latency_ms + " ms"}</td></tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="log-table">
      <thead><tr><th>Time</th><th>Outcome</th><th>Person</th><th class="num">Liveness</th><th class="num">Time taken</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  async function load() {
    let d, health;
    try {
      [d, health] = await Promise.all([TF.api("/api/stats"), TF.api("/api/health").catch((e) => e.payload || { status: "down", models: {} })]);
    } catch (e) {
      root.innerHTML = `<div class="verdict bad"><h3>Could not load the dashboard</h3><p>${TF.escape(e.message)}</p></div>`;
      return;
    }
    const by = d.stats.by_decision, total = d.stats.total_verifications;
    const rate = total ? Math.round(((by.verified || 0) / total) * 100) + "%" : "–";
    const syn = d.metrics && Object.values(d.metrics.tasks).some((t) => t.synthetic_attacks);
    const modelRows = Object.entries(health.models || {}).map(([k, ok]) =>
      `<li><span>${TF.escape(TASK[k] || k)} model</span><span class="badge ${ok ? "ok" : "bad"}">${ok ? "Loaded" : "Missing"}</span></li>`).join("");

    root.innerHTML = `
      ${syn ? `<div class="note"><b>Read the accuracy figures with care.</b> Liveness and deepfake models are tested on attacks simulated from 100 real 25×25 faces, not on real spoofing footage. Treat the numbers as a development baseline.</div>` : ""}
      <div class="tiles">
        <div class="tile"><div class="n">${d.users}</div><div class="l">Registered users</div></div>
        <div class="tile"><div class="n">${total}</div><div class="l">Verifications run</div></div>
        <div class="tile"><div class="n">${rate}</div><div class="l">Ended in a verified match</div></div>
        <div class="tile"><div class="n">${d.stats.avg_latency_ms ? d.stats.avg_latency_ms + " ms" : "–"}</div><div class="l">Average check time</div></div>
      </div>
      <div class="grid-2">
        <section class="sheet"><h2 style="font-size:1.3rem">Outcomes</h2>${outcomes(by)}</section>
        <section class="sheet"><h2 style="font-size:1.3rem">Checks in the last 7 days</h2>${activityBars(d.stats.per_day)}</section>
      </div>
      <section class="sheet" style="margin-bottom:1rem"><h2 style="font-size:1.3rem">Model accuracy in testing</h2>${metricsTable(d.metrics)}</section>
      <div class="grid-2">
        <section class="sheet"><h2 style="font-size:1.3rem">System health</h2>
          <ul class="health">
            <li><span>Service</span><span class="badge ${health.status === "ok" ? "ok" : "bad"}">${health.status === "ok" ? "Running" : "Needs attention"}</span></li>
            ${modelRows}
            <li><span>Liveness blocks a check</span><span class="badge ${d.enforce.liveness ? "ok" : "warn"}">${d.enforce.liveness ? "Yes" : "Advisory"}</span></li>
            <li><span>Deepfake screen blocks a check</span><span class="badge ${d.enforce.deepfake ? "ok" : "warn"}">${d.enforce.deepfake ? "Yes" : "Advisory"}</span></li>
          </ul></section>
        <section class="sheet"><h2 style="font-size:1.3rem">Decision thresholds</h2>
          <ul class="health">
            <li><span>Minimum liveness score</span><b>${Math.round(d.thresholds.liveness * 100)}%</b></li>
            <li><span>Minimum deepfake score</span><b>${Math.round(d.thresholds.deepfake * 100)}%</b></li>
            <li><span>Maximum match distance</span><b>${d.thresholds.recognition_distance}</b></li>
          </ul>
          <p class="meta-line">Change these with environment variables. See the README.</p></section>
      </div>
      <section class="sheet"><h2 style="font-size:1.3rem">Recent activity</h2>${logTable(d.logs)}</section>`;
  }
  load();
})();
