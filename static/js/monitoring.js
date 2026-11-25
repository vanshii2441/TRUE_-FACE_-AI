
(function () {
  const $ = (id) => document.getElementById(id);

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  async function getJSON(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok && response.status !== 503) {
      throw new Error(data.error || "Unable to load data.");
    }

    return data;
  }

  function errorMessage(error) {
    return `<p class="empty-note">Unable to load data: ${escapeHTML(error.message)}</p>`;
  }

  function statusBadge(status) {
    const value = String(status || "unknown").toLowerCase();
    const kind = value === "ok" || value === "true" || value === "loaded"
      ? "ok"
      : value === "degraded" || value === "false" || value === "unavailable"
        ? "bad"
        : "warn";

    return `<span class="badge ${kind}">${escapeHTML(status)}</span>`;
  }

  function renderLogs(logs) {
    if (!logs.length) {
      return '<p class="empty-note">No audit records are available yet.</p>';
    }

    return `
      <div class="table-wrap">
        <table class="log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Decision</th>
              <th>User</th>
              <th>Liveness</th>
              <th>Deepfake</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td>${escapeHTML(log.created_at)}</td>
                <td>${escapeHTML(log.event)}</td>
                <td>${escapeHTML(log.decision || "—")}</td>
                <td>${escapeHTML(log.user_name || "—")}</td>
                <td>${log.liveness_score == null ? "—" : escapeHTML((log.liveness_score * 100).toFixed(1) + "%")}</td>
                <td>${log.deepfake_score == null ? "—" : escapeHTML((log.deepfake_score * 100).toFixed(1) + "%")}</td>
                <td>${log.latency_ms == null ? "—" : escapeHTML(log.latency_ms + " ms")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function loadAuditLogs() {
    const target = $("auditLogs");

    try {
      const data = await getJSON("/api/logs");
      target.innerHTML = `<p class="muted">Showing the latest ${data.logs.length} records.</p>
                          ${renderLogs(data.logs)}`;
    } catch (error) {
      target.innerHTML = errorMessage(error);
    }
  }

  async function loadThreatMonitor() {
    const target = $("threatMonitor");

    try {
      const data = await getJSON("/api/logs");

      const threats = data.logs.filter(log => {
        const decision = String(log.decision || "").toLowerCase();
        return /spoof|deepfake|reject|fail/.test(decision);
      });

      target.innerHTML = `
        <div class="tiles">
          <div class="tile">
            <div class="n">${threats.length}</div>
            <div class="l">Suspicious events in latest ${data.logs.length} records</div>
          </div>
          <div class="tile">
            <div class="n">${data.logs.length}</div>
            <div class="l">Recent audit records checked</div>
          </div>
        </div>
        <h2 style="font-size:1.4rem">Detected security events</h2>
        ${threats.length
          ? renderLogs(threats)
          : '<p class="empty-note">No suspicious events found in the available recent records.</p>'}
        <p class="hint">This page reports events recorded by the verification pipeline. It does not independently detect attacks.</p>
      `;
    } catch (error) {
      target.innerHTML = errorMessage(error);
    }
  }

  async function loadModelAnalytics() {
    const target = $("modelAnalytics");

    try {
      const data = await getJSON("/api/stats");
      const health = await getJSON("/api/health");

      const thresholds = data.thresholds || {};
      const metrics = data.metrics;

      target.innerHTML = `
        <div class="tiles">
          <div class="tile">
            <div class="n">${escapeHTML(data.users ?? 0)}</div>
            <div class="l">Registered users</div>
          </div>
          <div class="tile">
            <div class="n">${escapeHTML(data.stats?.total_verifications ?? 0)}</div>
            <div class="l">Total verifications</div>
          </div>
          <div class="tile">
            <div class="n">${escapeHTML(data.stats?.avg_latency_ms ?? 0)} ms</div>
            <div class="l">Average verification time</div>
          </div>
          <div class="tile">
            <div class="n">${metrics ? "Available" : "N/A"}</div>
            <div class="l">Training metrics file</div>
          </div>
        </div>

        <div class="grid-2">
          <section class="sheet">
            <h2 style="font-size:1.3rem">Model availability</h2>
            <ul class="health">
              ${Object.entries(health.models || {}).map(([name, loaded]) => `
                <li><span>${escapeHTML(name)}</span>
                    ${statusBadge(loaded ? "Loaded" : "Unavailable")}</li>
              `).join("")}
            </ul>
            <p class="meta-line">Detector: ${escapeHTML(health.detector || "Unknown")}</p>
            <p class="meta-line">Recognizer: ${escapeHTML(health.recognizer || "Unknown")}</p>
          </section>

          <section class="sheet">
            <h2 style="font-size:1.3rem">Configured thresholds</h2>
            <ul class="health">
              ${Object.entries(thresholds).map(([name, value]) => `
                <li><span>${escapeHTML(name)}</span>
                    <strong>${escapeHTML(value)}</strong></li>
              `).join("")}
            </ul>
          </section>
        </div>

        <section class="sheet" style="margin-top:1rem">
          <h2 style="font-size:1.3rem">Training metrics</h2>
          <pre style="white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink-2)">${escapeHTML(
            metrics ? JSON.stringify(metrics, null, 2) : "No metrics.json file was found."
          )}</pre>
        </section>
      `;
    } catch (error) {
      target.innerHTML = errorMessage(error);
    }
  }

  async function loadSystemStatus() {
    const target = $("systemStatus");

    try {
      const health = await getJSON("/api/health");

      const components = Object.entries(health.models || {});
      target.innerHTML = `
        <div class="tiles">
          <div class="tile">
            <div class="n">${escapeHTML(health.status || "Unknown")}</div>
            <div class="l">Overall backend status</div>
          </div>
          <div class="tile">
            <div class="n">${escapeHTML(health.users ?? 0)}</div>
            <div class="l">Registered identities</div>
          </div>
        </div>

        <section class="sheet">
          <h2 style="font-size:1.4rem">Component health</h2>
          <ul class="health">
            <li><span>Backend API</span>${statusBadge(health.status)}</li>
            ${components.map(([name, loaded]) => `
              <li><span>${escapeHTML(name)} model</span>
                  ${statusBadge(loaded ? "Loaded" : "Unavailable")}</li>
            `).join("")}
            <li><span>Face detector</span>${statusBadge(health.detector || "Unknown")}</li>
            <li><span>Face recognizer</span>${statusBadge(health.recognizer || "Unknown")}</li>
          </ul>
        </section>

        <section class="sheet" style="margin-top:1rem">
          <h2 style="font-size:1.3rem">Security configuration</h2>
          <ul class="health">
            <li><span>Enforce liveness</span>${statusBadge(health.enforce_liveness ? "Enabled" : "Disabled")}</li>
            <li><span>Enforce deepfake check</span>${statusBadge(health.enforce_deepfake ? "Enabled" : "Disabled")}</li>
          </ul>
        </section>
      `;
    } catch (error) {
      target.innerHTML = errorMessage(error);
    }
  }

  if ($("auditLogs")) loadAuditLogs();
  if ($("threatMonitor")) loadThreatMonitor();
  if ($("modelAnalytics")) loadModelAnalytics();
  if ($("systemStatus")) loadSystemStatus();
})();
