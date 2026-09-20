// ── Global schedules ───────────────────────────────────────────────────────
let _schedules = [];
let _editingSchedule = null;
let _creatingSchedule = false;

function _scheduleItems(value) {
  return Array.isArray(value) ? value : [];
}
function _scheduleId(s) { return s.id; }
function _scheduleDevices(s) { return s.device_serials; }
function _scheduleMode(s) { return s.kind === "date" ? "specific_date" : "daily"; }
function _scheduleTime(s) { return s.local_time; }
function _scheduleName(s) { return s.name || ""; }
function _scheduleEnabled(s) { return s.enabled; }

function _schedulePayload() {
  const mode = document.getElementById("sc-mode").value;
  const devices = Array.from(document.getElementById("sc-devices").selectedOptions).map(o => o.value);
  return {
    name: document.getElementById("sc-name").value.trim(),
    kind: mode === "specific_date" ? "date" : "daily",
    ...(mode === "specific_date" ? { local_date: document.getElementById("sc-date").value } : {}),
    local_time: document.getElementById("sc-time").value,
    timezone: _creatingSchedule ? (_settings.feeder_timezone || "Etc/UTC") : _editingSchedule.timezone,
    plate: Number(document.getElementById("sc-plate").value),
    feeding_duration: Number(document.getElementById("sc-duration").value),
    device_serials: devices,
    enabled: _creatingSchedule ? true : _editingSchedule.enabled,
  };
}

function _scheduleForm(s = {}) {
  const mode = _scheduleMode(s);
  const selected = new Set((s.device_serials || []).map(String));
  const polars = _devices.filter(d => d.device_type === "polar");
  const timezone = s.timezone || _settings.feeder_timezone || "Etc/UTC";
  return `<div class="sched-form open" id="global-sched-form">
    <div class="schedule-form-grid">
      <div class="form-row"><label for="sc-name">${t("schedules.name")}</label><input class="form-input" id="sc-name" maxlength="80" value="${escHtml(_scheduleName(s))}"></div>
      <div class="form-row"><label for="sc-mode">${t("schedules.repeat")}</label><select class="form-select" id="sc-mode"><option value="daily" ${mode === "daily" ? "selected" : ""}>${t("schedules.daily")}</option><option value="specific_date" ${mode === "specific_date" ? "selected" : ""}>${t("schedules.specific_date")}</option></select></div>
      <div class="form-row" id="sc-date-row" style="${mode === "specific_date" ? "" : "display:none"}"><label for="sc-date">${t("schedules.date")}</label><input class="form-input" id="sc-date" type="date" value="${escHtml(s?.local_date || "")}"></div>
      <div class="form-row"><label for="sc-time">${t("schedules.time")}</label><input class="form-input" id="sc-time" type="time" value="${escHtml(s.local_time || "08:00")}" required><p class="form-hint">${t("schedules.timezone", {tz: timezone})}</p></div>
      <div class="form-row"><label for="sc-plate">${t("schedules.plate")}</label><input class="form-input" id="sc-plate" type="number" min="1" max="3" value="${escHtml(s?.plate ?? 1)}"></div>
      <div class="form-row"><label for="sc-duration">${t("schedules.duration")}</label><input class="form-input" id="sc-duration" type="number" min="1" max="1440" value="${escHtml(s?.feeding_duration ?? 240)}"></div>
    </div>
    <div class="form-row"><label for="sc-devices">${t("schedules.devices")}</label><select class="form-select schedule-devices" id="sc-devices" multiple size="${Math.min(4, Math.max(2, polars.length))}">${polars.map(d => `<option value="${escHtml(d.serial)}" ${selected.has(String(d.serial)) ? "selected" : ""}>${escHtml(d.name || d.serial)}</option>`).join("")}</select><p class="form-hint">${t("schedules.devices_hint")}</p></div>
    <div class="schedule-form-actions"><button class="btn-primary" id="sc-save">${t("schedules.save")}</button><button class="btn-secondary" id="sc-cancel">${t("schedules.cancel")}</button></div>
  </div>`;
}

function _scheduleRow(s) {
  const names = _scheduleDevices(s).map(id => _devices.find(d => String(d.serial) === String(id))?.name || id).join(", ");
  const mode = _scheduleMode(s);
  const when = mode === "specific_date" ? t("schedules.date_at", {date: s.local_date || "", time: _scheduleTime(s)}) : t("schedules.daily_at", {time: _scheduleTime(s)});
  const id = _scheduleId(s);
  return `<div class="sched-row${_scheduleEnabled(s) ? "" : " disabled"}"><div class="sched-time">${escHtml(_scheduleTime(s))}</div><div class="sched-meta"><strong>${escHtml(_scheduleName(s) || t("schedules.unnamed"))}</strong><br>${escHtml(when)} · ${escHtml(names || t("schedules.no_devices"))} · ${t("schedules.plate_value", {plate: s.plate})} · ${t("schedules.minutes", {n: s.feeding_duration})}</div><div class="sched-actions"><button class="sched-toggle${_scheduleEnabled(s) ? " on" : ""}" data-id="${escHtml(id)}" title="${t("schedules.toggle")}" aria-label="${t("schedules.toggle")}"></button><button class="sched-edit-btn" data-id="${escHtml(id)}" title="${t("schedules.edit")}">✏️</button><button class="sched-del-btn" data-id="${escHtml(id)}" title="${t("schedules.delete")}">&#x2715;</button></div></div>`;
}

function renderSchedules() {
  const root = document.getElementById("schedules-panel");
  if (!root) return;
  root.innerHTML = `<div class="schedules-head"><div><div class="tab-section-heading">${t("schedules.heading")}</div><p class="form-hint">${t("schedules.description")}</p></div><div class="schedule-head-actions"><button class="btn-secondary" id="sc-resend">${t("schedules.resend")}</button><button class="btn-primary" id="sc-add">${t("schedules.add")}</button></div></div><div id="schedules-content"><p class="schedule-state">${t("schedules.loading")}</p></div>`;
  api("GET", "/api/schedules").then(data => { _schedules = _scheduleItems(data); _renderScheduleContent(); }).catch(() => { document.getElementById("schedules-content").innerHTML = `<p class="schedule-state error">${t("schedules.error")}</p>`; });
  document.getElementById("sc-add").onclick = () => { _creatingSchedule = true; _editingSchedule = {}; _renderScheduleContent(); };
  document.getElementById("sc-resend").onclick = async () => {
    if (!confirm(t("schedules.resend_confirm"))) return;
    const button = document.getElementById("sc-resend");
    button.disabled = true;
    try {
      await api("POST", "/api/schedules/reconcile");
      showToast(t("schedules.resend_success"));
    } catch (e) {
      showToast(t("schedules.resend_error"));
    } finally {
      button.disabled = false;
    }
  };
}
function _renderScheduleContent() {
  const root = document.getElementById("schedules-content"); if (!root) return;
  root.innerHTML = (_editingSchedule ? _scheduleForm(_editingSchedule) : "") + (_schedules.length ? `<div class="sched-list">${_schedules.map(_scheduleRow).join("")}</div>` : `<p class="schedule-state">${t("schedules.empty")}</p>`);
  const mode = document.getElementById("sc-mode");
  if (mode) mode.onchange = () => { document.getElementById("sc-date-row").style.display = mode.value === "specific_date" ? "" : "none"; };
  document.getElementById("sc-cancel")?.addEventListener("click", () => { _creatingSchedule = false; _editingSchedule = null; _renderScheduleContent(); });
  document.getElementById("sc-save")?.addEventListener("click", async () => {
    const p = _schedulePayload();
    if (!p.local_time || (p.kind === "date" && !p.local_date) || !p.device_serials.length || p.plate < 1 || p.plate > 3 || p.feeding_duration < 1 || p.feeding_duration > 1440) return showToast(t("schedules.invalid"));
    try { if (_creatingSchedule) await api("POST", "/api/schedules", p); else await api("POST", `/api/schedules/${encodeURIComponent(_scheduleId(_editingSchedule))}`, {...p, id: _editingSchedule.id}); _creatingSchedule = false; _editingSchedule = null; renderSchedules(); } catch (e) { showToast(t("schedules.save_error")); }
  });
  root.querySelectorAll(".sched-edit-btn").forEach(b => b.onclick = () => { _creatingSchedule = false; _editingSchedule = _schedules.find(s => String(_scheduleId(s)) === b.dataset.id); _renderScheduleContent(); });
  root.querySelectorAll(".sched-del-btn").forEach(b => b.onclick = async () => { if (!confirm(t("schedules.delete_confirm"))) return; try { await api("DELETE", `/api/schedules/${encodeURIComponent(b.dataset.id)}`); renderSchedules(); } catch { showToast(t("schedules.delete_error")); } });
  root.querySelectorAll(".sched-toggle").forEach(b => b.onclick = async () => { const s = _schedules.find(x => String(_scheduleId(x)) === b.dataset.id); if (!s) return; const p = {id: s.id, name: s.name, kind: s.kind, ...(s.kind === "date" ? {local_date: s.local_date} : {}), local_time: s.local_time, timezone: s.timezone, plate: s.plate, feeding_duration: s.feeding_duration, device_serials: s.device_serials, enabled: !_scheduleEnabled(s)}; try { await api("POST", `/api/schedules/${encodeURIComponent(b.dataset.id)}`, p); renderSchedules(); } catch { showToast(t("schedules.save_error")); } });
}
