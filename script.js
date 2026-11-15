// Community Disaster Alert and Preparedness System
// Plain JavaScript. All data is kept in one object (db) saved in localStorage.

// ---------- 1. Constants ----------
const KEY = "cdaps_db";
const DEF = [9.5953, 123.7896]; // default map center (Lourdes, Panglao, Bohol) if location is unavailable
const OLD_DEF = [14.676, 121.0437]; // earlier default (Quezon City), used to convert older saved data
const LVCOL = ["#475569", "#15803d", "#b45309", "#c2410c", "#b91c1c"]; // alert level colors for the map
const LV = ["None", "Low", "Moderate", "High", "Critical"];
const TYPES = ["Typhoon", "Flood", "Earthquake", "Fire", "Landslide", "Other"];
const RTYPES = ["Flood", "Fire", "Damaged road", "Power outage", "Other"];
const BAG = ["Drinking water (3 days)", "Canned food and can opener", "Flashlight and batteries",
  "First aid kit and medicines", "Power bank and charger", "Whistle", "Copies of IDs in a waterproof bag",
  "Cash in small bills", "Battery-powered radio", "Clothes and blanket"];
const TIPS = ["Keep your phone charged before a storm arrives.", "Know two ways out of every room.",
  "Never walk or drive through floodwater.", "Drop, cover, and hold on during an earthquake.",
  "Store drinking water: 3 liters per person per day.", "Agree on a family meeting point.",
  "Turn off the main power switch if your home floods.", "Check on elderly neighbors after a disaster."];
const NAV = {
  resident: [["dash", "Dashboard"], ["alerts", "Alerts and History"], ["weather", "Weather"], ["guide", "Safety Guide"],
    ["gobag", "Go-Bag"], ["quiz", "Quiz"], ["centers", "Evacuation Centers"], ["hotlines", "Hotlines"], ["report", "Report Incident"], ["map", "Map"]],
  admin: [["dash", "Dashboard"], ["alerts", "Manage Alerts"], ["weather", "Weather"], ["centers", "Centers"],
    ["hotlines", "Contacts"], ["report", "Reports"], ["news", "Announcements"], ["users", "Users"], ["logs", "Activity Logs"], ["map", "Map"]]
};

// ---------- 2. Helpers ----------
const $ = id => document.getElementById(id);
const now = () => new Date().toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function esc(text) { const d = document.createElement("div"); d.textContent = text; return d.innerHTML; } // blocks HTML injection
function fill(id, items, row, empty) {
  $(id).innerHTML = items.length ? items.map(row).join("") : '<li class="empty">' + empty + "</li>";
}
const btn = (label, act, id, to = "", cls = "") =>
  `<button class="btn small ${cls}" data-act="${act}" data-id="${id}" data-to="${to}">${label}</button>`;
const adm = (...b) => `<div class="acts admin-only">${b.join("")}</div>`;

// ---------- 3. Data (localStorage) ----------
// Sample evacuation centers. Pin positions are approximate: the admin should edit them to the real places.
function sampleCenters() {
  return [
    { id: "c1", name: "Lourdes National High School (sample pin)", address: "Lourdes, Panglao, Bohol", capacity: 400, lat: 9.5960, lng: 123.7900 },
    { id: "c2", name: "Lourdes Barangay Hall (sample pin)", address: "Lourdes, Panglao, Bohol", capacity: 150, lat: 9.5945, lng: 123.7885 },
    { id: "c3", name: "Looc Barangay Hall (sample pin)", address: "Looc, Panglao, Bohol", capacity: 150, lat: 9.5933, lng: 123.7542 }
  ];
}

function seed() {
  return {
    users: [{ id: "u1", name: "Administrator", user: "admin", pass: "admin123", role: "admin", active: true, joined: now() }],
    alerts: [], reports: [], logs: [], news: [], bags: {},
    seedv: 2,
    centers: sampleCenters(),
    contacts: [{ id: "h1", name: "National Emergency Hotline", number: "911" }, { id: "h2", name: "Philippine Red Cross", number: "143" }],
    weather: { condition: "Partly cloudy", temp: 31, humidity: 70, wind: "15 km/h", time: now(),
      forecast: ["Tomorrow: Rain showers, 28°C", "Day 2: Cloudy, 29°C", "Day 3: Sunny, 32°C"] }
  };
}
function load() {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { d = seed(); }
  d.quiz = d.quiz || {}; // quiz scores per user (older saved data may not have this)
  if (d.seedv !== 2) {  // older saved data: move the sample data from Quezon City to Lourdes, Panglao
    (d.reports || []).forEach(r => { if (r.lat !== undefined) { r.lat = Number(r.lat) - OLD_DEF[0] + DEF[0]; r.lng = Number(r.lng) - OLD_DEF[1] + DEF[1]; } });
    d.centers = (d.centers || []).filter(c => !["c1", "c2", "c3"].includes(c.id)).concat(sampleCenters());
    d.seedv = 2;
  }
  // Older saved data used X/Y percent positions; convert them to real coordinates
  const fix = o => { if (o.lat === undefined) { o.lat = DEF[0] + (50 - (o.y || 50)) * 0.0004; o.lng = DEF[1] + ((o.x || 50) - 50) * 0.0004; } };
  (d.centers || []).forEach(fix); (d.reports || []).forEach(fix);
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert("Could not save. Browser storage may be full or blocked."); }
}
function log(action) { db.logs.unshift({ t: now(), who: me ? me.user : "guest", action: action }); db.logs = db.logs.slice(0, 200); }

let db = load();
let me = db.users.find(u => u.id === sessionStorage.getItem("cdaps_me") && u.active) || null; // session = this tab only
let tipN = 0, pins = [];
save();

// ---------- 4. Login, register, logout ----------
$("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".error");
  const u = f.elements.user.value.trim(), p = f.elements.pass.value;
  const acc = db.users.find(x => x.user.toLowerCase() === u.toLowerCase() && x.pass === p);
  if (!u || !p) { err.textContent = "Enter your username and password."; return; }
  if (!acc) { err.textContent = "Wrong username or password."; return; }
  if (!acc.active) { err.textContent = "This account is deactivated. Contact the administrator."; return; }
  err.textContent = ""; f.reset();
  me = acc; sessionStorage.setItem("cdaps_me", acc.id);
  log("Logged in"); save(); enter();
});

$("reg-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, el = f.elements, err = f.querySelector(".error");
  const name = el.fullname.value.trim(), user = el.user.value.trim(), pass = el.pass.value;
  if (name.length < 3) { err.textContent = "Enter your full name (3+ characters)."; return; }
  if (!/^[a-zA-Z0-9_]{4,15}$/.test(user)) { err.textContent = "Username must be 4-15 letters, numbers, or _."; return; }
  if (db.users.some(x => x.user.toLowerCase() === user.toLowerCase())) { err.textContent = "That username is taken."; return; }
  if (pass.length < 6) { err.textContent = "Password must be at least 6 characters."; return; }
  err.textContent = ""; f.reset();
  me = { id: uid(), name: name, user: user, pass: pass, role: "resident", active: true, joined: now() };
  db.users.push(me); sessionStorage.setItem("cdaps_me", me.id);
  log("Registered"); save(); enter();
});

$("logout").addEventListener("click", () => { log("Logged out"); save(); leave(); });

function enter() {
  document.body.dataset.role = me.role;
  $("who-name").textContent = me.name + " (" + me.role + ")";
  $("nav").innerHTML = NAV[me.role].map(n => `<button class="tab" data-v="${n[0]}">${n[1]}</button>`).join("");
  show("dash");
}
function leave() {
  sessionStorage.removeItem("cdaps_me"); me = null;
  document.body.dataset.role = "guest"; $("who-name").textContent = ""; $("nav").innerHTML = "";
  show("auth");
}

// ---------- 5. Navigation ----------
function show(v) {
  document.querySelectorAll(".view").forEach(s => s.classList.toggle("hidden", s.id !== "v-" + v));
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.v === v));
  if (v === "quiz" && me) renderQuiz();
  if (v === "weather" && me && me.role === "admin") { // put current values into the admin form
    const el = $("weather-form").elements, w = db.weather;
    el.condition.value = w.condition; el.temp.value = w.temp; el.humidity.value = w.humidity;
    el.wind.value = w.wind; el.forecast.value = w.forecast.join("\n");
  }
  renderAll();
}
$("nav").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) show(b.dataset.v); });

// ---------- 6. Reusable add / edit / remove for simple lists ----------
// Used for alerts, evacuation centers, contacts, and announcements.
function crud(c) {
  const f = $(c.form), err = f.querySelector(".error");
  f.addEventListener("submit", e => {
    e.preventDefault();
    const rec = {};
    c.fields.forEach(k => rec[k] = f.elements[k].value.trim());
    if (c.extra) Object.assign(rec, c.extra(e));
    const msg = c.check(rec);
    if (msg) { err.textContent = msg; return; }
    err.textContent = "";
    const id = f.elements.id.value;
    if (id) { Object.assign(db[c.coll].find(r => r.id === id), rec); log("Edited " + c.label + ": " + rec[c.fields[0]]); }
    else { db[c.coll].unshift(Object.assign({ id: uid(), time: now() }, rec)); log("Added " + c.label + ": " + rec[c.fields[0]]); }
    if (rec.status === "published") log("Published " + c.label + ": " + rec[c.fields[0]]);
    f.reset(); save(); renderAll();
  });
  $(c.list).addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const r = db[c.coll].find(x => x.id === b.dataset.id); if (!r) return;
    const act = b.dataset.act;
    if (act === "edit") { c.fields.forEach(k => f.elements[k].value = r[k]); f.elements.id.value = r.id; f.scrollIntoView(); return; }
    if (act === "status") { r.status = b.dataset.to; log(b.dataset.to + " " + c.label + ": " + r.title); }
    else if (act === "del" && confirm("Remove this " + c.label + "?")) {
      db[c.coll] = db[c.coll].filter(x => x !== r); log("Removed " + c.label + ": " + r[c.fields[0]]);
    } else return;
    save(); renderAll();
  });
}

crud({ coll: "alerts", form: "alert-form", list: "alert-list", label: "alert",
  fields: ["title", "type", "level", "zone", "location", "details"],
  extra: e => ({ status: (e.submitter && e.submitter.dataset.status) || "draft" }),
  check: r => r.title.length < 5 ? "Title needs at least 5 characters."
    : !r.location ? "Enter the location."
    : r.details.length < 10 ? "Tell residents what to do (10+ characters)." : "" });

crud({ coll: "centers", form: "center-form", list: "center-list", label: "evacuation center",
  fields: ["name", "address", "capacity", "lat", "lng"],
  check: r => r.name.length < 3 ? "Enter the center name."
    : !r.address ? "Enter the address."
    : !(Number(r.capacity) > 0) ? "Capacity must be more than 0."
    : !(r.lat !== "" && Math.abs(r.lat) <= 90 && r.lng !== "" && Math.abs(r.lng) <= 180) ? "Enter a valid latitude (-90 to 90) and longitude (-180 to 180)." : "" });

crud({ coll: "contacts", form: "contact-form", list: "contact-list", label: "contact",
  fields: ["name", "number"],
  check: r => r.name.length < 3 ? "Enter the contact name."
    : !/^[0-9+\-\s()]{3,15}$/.test(r.number) ? "Enter a valid phone number." : "" });

crud({ coll: "news", form: "news-form", list: "news-admin", label: "announcement",
  fields: ["title", "message"],
  check: r => r.title.length < 3 ? "Enter a title." : r.message.length < 10 ? "Message needs at least 10 characters." : "" });

// ---------- 7. Rendering ----------
function renderAll() {
  updateBanner();
  if (!me) return;
  renderDash(); renderAlerts(); renderWeather(); renderBag(); renderCenters();
  renderContacts(); renderReports(); renderNews(); renderUsers(); renderLogs(); renderMap();
}

function updateBanner() {
  const live = db.alerts.filter(a => a.status === "published");
  const top = live.reduce((m, a) => Math.max(m, Number(a.level)), 0);
  $("banner").className = "banner lv" + top;
  $("banner").textContent = live.length ? live.length + " active alert(s). Highest level: " + LV[top] : "No active alerts";
}

const logRow = l => `<li class="card"><b>${esc(l.who)}</b> ${esc(l.action)} <span class="meta">${l.t}</span></li>`;

function renderDash() {
  const live = db.alerts.filter(a => a.status === "published");
  fill("dash-alerts", live, alertCard, "No active alerts. Stay prepared.");
  fill("news-list", db.news.slice(0, 5), n => `<li class="card"><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p><p class="meta">${n.time}</p></li>`, "No announcements.");
  $("quick").innerHTML = db.contacts.slice(0, 3).map(c => `<a class="btn" href="tel:${esc(c.number)}">${esc(c.name)}: ${esc(c.number)}</a>`).join("");
  $("tip").textContent = "Tip: " + TIPS[tipN % TIPS.length];
  const st = [["Residents", db.users.filter(u => u.role === "resident").length], ["Active alerts", live.length],
    ["Pending reports", db.reports.filter(r => r.status === "Pending").length], ["Evacuation centers", db.centers.length]];
  $("stats").innerHTML = st.map(s => `<div class="stat"><b>${s[1]}</b>${s[0]}</div>`).join("");
  fill("recent", db.logs.slice(0, 5), logRow, "No activity yet.");
}
$("next-tip").addEventListener("click", () => { tipN++; renderDash(); });

function alertCard(a) {
  return `<li class="card lv${a.level}"><h3>${esc(a.title)}</h3><span class="tag">${LV[a.level]}</span>
    <span class="meta">${esc(a.type)} | ${esc(a.location)} | ${a.status}</span><p>${esc(a.details)}</p><p class="meta">${a.time}</p>
    ${adm(btn("Edit", "edit", a.id), a.status === "published" ? btn("Archive", "status", a.id, "archived") : btn("Publish", "status", a.id, "published"), btn("Delete", "del", a.id, "", "danger"))}</li>`;
}

function renderAlerts() {
  const q = $("f-q").value.toLowerCase(), t = $("f-type").value, s = $("f-status").value;
  const list = db.alerts.filter(a => (me.role === "admin" || a.status !== "draft")
    && (s === "all" || a.status === s) && (t === "all" || a.type === t)
    && (a.title + a.location + a.details).toLowerCase().includes(q));
  fill("alert-list", list, alertCard, "No alerts match.");
}

function renderWeather() {
  const w = db.weather;
  $("weather-card").innerHTML = `<h2>${esc(w.condition)}, ${esc(w.temp)}°C</h2><p>Humidity ${esc(w.humidity)}% | Wind ${esc(w.wind)}</p>
    <h3>Forecast</h3><ul>${w.forecast.map(x => "<li>" + esc(x) + "</li>").join("")}</ul><p class="meta">Updated ${w.time}</p>`;
}
$("weather-form").addEventListener("submit", e => {
  e.preventDefault();
  const el = e.target.elements, err = e.target.querySelector(".error");
  const temp = Number(el.temp.value), hum = Number(el.humidity.value);
  if (!el.condition.value.trim()) { err.textContent = "Enter the weather condition."; return; }
  if (el.temp.value === "" || temp < -10 || temp > 50) { err.textContent = "Temperature must be between -10 and 50."; return; }
  if (el.humidity.value === "" || hum < 0 || hum > 100) { err.textContent = "Humidity must be between 0 and 100."; return; }
  err.textContent = "";
  db.weather = { condition: el.condition.value.trim(), temp: temp, humidity: hum, wind: el.wind.value.trim() || "n/a",
    forecast: el.forecast.value.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 5), time: now() };
  log("Updated weather"); save(); renderAll();
});

function renderBag() {
  const done = db.bags[me.id] || [];
  $("bag-list").innerHTML = BAG.map((n, i) => `<li class="${done.includes(n) ? "done" : ""}"><label>
    <input type="checkbox" data-i="${i}" ${done.includes(n) ? "checked" : ""}>${esc(n)}</label></li>`).join("");
  const p = Math.round(done.length / BAG.length * 100);
  $("bag-bar").style.width = p + "%";
  $("bag-text").textContent = done.length + " of " + BAG.length + " items packed (" + p + "%)";
}
$("bag-list").addEventListener("change", e => {
  const name = BAG[e.target.dataset.i], d = db.bags[me.id] || [];
  db.bags[me.id] = e.target.checked ? d.concat(name) : d.filter(x => x !== name);
  save(); renderBag();
});

function renderCenters() {
  const q = $("c-q").value.toLowerCase();
  fill("center-list", db.centers.filter(c => (c.name + c.address).toLowerCase().includes(q)),
    c => `<li class="card"><h3>${esc(c.name)}</h3><p>${esc(c.address)}</p><p class="meta">Capacity: ${esc(c.capacity)} people</p>
      ${adm(btn("Edit", "edit", c.id), btn("Remove", "del", c.id, "", "danger"))}</li>`, "No evacuation centers found.");
}

function renderContacts() {
  fill("contact-list", db.contacts, c => `<li class="card"><span class="num">${esc(c.number)}</span><h3>${esc(c.name)}</h3>
    ${adm(btn("Edit", "edit", c.id), btn("Remove", "del", c.id, "", "danger"))}</li>`, "No contacts yet.");
}

function renderNews() {
  fill("news-admin", db.news, n => `<li class="card"><h3>${esc(n.title)}</h3><p>${esc(n.message)}</p><p class="meta">${n.time}</p>
    ${adm(btn("Edit", "edit", n.id), btn("Remove", "del", n.id, "", "danger"))}</li>`, "No announcements yet.");
}

// Incident reports
$("report-form").addEventListener("submit", e => {
  e.preventDefault();
  const el = e.target.elements, err = e.target.querySelector(".error");
  const loc = el.location.value.trim(), desc = el.description.value.trim();
  if (loc.length < 3) { err.textContent = "Enter where it is happening."; return; }
  if (desc.length < 10) { err.textContent = "Describe the incident (10+ characters)."; return; }
  err.textContent = "";
  err.textContent = "Sending report...";
  const f = e.target, type = el.type.value;
  where(pos => {                                   // pin the report at the resident's location
    db.reports.unshift({ id: uid(), user: me.id, by: me.name, type: type, location: loc, description: desc,
      status: "Pending", time: now(), lat: pos[0], lng: pos[1] });
    log("Submitted report: " + type); err.textContent = ""; f.reset(); save(); renderAll();
  });
});

function renderReports() {
  const q = $("r-q").value.toLowerCase(), s = $("r-status").value, admin = me.role === "admin";
  const list = db.reports.filter(r => (admin || r.user === me.id) && (s === "all" || r.status === s)
    && (r.type + r.location + r.description).toLowerCase().includes(q));
  fill("report-list", list, r => `<li class="card"><h3>${esc(r.type)}: ${esc(r.location)}</h3><p>${esc(r.description)}</p>
    <p class="meta">By ${esc(r.by)} | ${r.time}</p>` + (admin
      ? `<select data-id="${r.id}" aria-label="Report status">${["Pending", "Under Review", "Resolved"].map(x => `<option ${x === r.status ? "selected" : ""}>${x}</option>`).join("")}</select>`
      : `<span class="tag">${r.status}</span>`) + "</li>", "No reports to show.");
}
$("report-list").addEventListener("change", e => {
  const r = db.reports.find(x => x.id === e.target.dataset.id); if (!r) return;
  r.status = e.target.value; log("Set report to " + r.status + ": " + r.type + " at " + r.location); save(); renderAll();
});

// Users and logs (admin)
function renderUsers() {
  fill("user-list", db.users.filter(u => u.role === "resident"), u => `<li class="card"><h3>${esc(u.name)}</h3>
    <p class="meta">@${esc(u.user)} | joined ${u.joined} | ${u.active ? "Active" : "Deactivated"}</p>
    <div class="acts">${btn(u.active ? "Deactivate" : "Activate", "tog", u.id)}${btn("Delete", "del", u.id, "", "danger")}</div></li>`, "No registered residents yet.");
}
$("user-list").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const u = db.users.find(x => x.id === b.dataset.id); if (!u) return;
  if (b.dataset.act === "tog") { u.active = !u.active; log((u.active ? "Activated " : "Deactivated ") + u.user); }
  else if (confirm("Delete this account?")) { db.users = db.users.filter(x => x !== u); log("Deleted user " + u.user); }
  else return;
  save(); renderAll();
});
function renderLogs() { fill("log-list", db.logs, logRow, "No activity yet."); }

// ---------- 8. Map (Leaflet + OpenStreetMap, centered on the user's location) ----------
let map = null, layer = null, here = null;   // here = [lat, lng] of the user once found

// Gives [lat, lng] of the user, or the default center with a small random offset if location is blocked.
function where(cb) {
  const fallback = () => cb([DEF[0] + (Math.random() - 0.5) * 0.02, DEF[1] + (Math.random() - 0.5) * 0.02]);
  if (here) { cb(here); return; }
  if (!navigator.geolocation) { fallback(); return; }
  navigator.geolocation.getCurrentPosition(p => { here = [p.coords.latitude, p.coords.longitude]; cb(here); }, fallback, { timeout: 8000 });
}

// Ask the browser for the user's position and move the map there.
function locate() {
  const msg = $("map-msg");
  if (!navigator.geolocation) { msg.textContent = "Your browser cannot share location. Showing Lourdes, Panglao."; return; }
  msg.textContent = "Finding your location...";
  navigator.geolocation.getCurrentPosition(p => {
    here = [p.coords.latitude, p.coords.longitude];
    msg.textContent = "Map centered on your current location.";
    map.setView(here, 15); renderMap();
  }, () => { msg.textContent = "Location blocked or unavailable. Showing Lourdes, Panglao. Allow location access, then press the button again."; }, { timeout: 10000 });
}
$("locate").addEventListener("click", () => { if (map) locate(); });

function renderMap() {
  if ($("v-map").classList.contains("hidden")) return;      // only draw when the Map tab is open
  if (typeof L === "undefined") { $("map").innerHTML = '<p class="empty">The map could not load. Check your internet connection.</p>'; return; }
  if (!map) {                                               // first time: create the map
    map = L.map("map").setView(here || DEF, 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    layer = L.layerGroup().addTo(map);
    locate();
  }
  map.invalidateSize();
  layer.clearLayers();
  const c = here || DEF, d = 0.03;                           // alert zones = four squares around the map center
  const quad = { NW: [[c[0], c[1] - d], [c[0] + d, c[1]]], NE: [[c[0], c[1]], [c[0] + d, c[1] + d]],
                 SW: [[c[0] - d, c[1] - d], [c[0], c[1]]], SE: [[c[0] - d, c[1]], [c[0], c[1] + d]] };
  db.alerts.filter(a => a.status === "published" && quad[a.zone]).forEach(a =>
    L.rectangle(quad[a.zone], { color: LVCOL[a.level], weight: 1, fillOpacity: 0.25 })
      .bindPopup("<b>" + esc(a.title) + "</b><br>" + LV[a.level] + " alert").addTo(layer));
  db.centers.forEach(x => L.marker([Number(x.lat), Number(x.lng)])
    .bindPopup("<b>Evacuation center</b><br>" + esc(x.name) + "<br>" + esc(x.address)).addTo(layer));
  db.reports.filter(r => r.status !== "Resolved").forEach(r =>
    L.circleMarker([Number(r.lat), Number(r.lng)], { radius: 9, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 })
      .bindPopup("<b>" + esc(r.type) + "</b><br>" + esc(r.location) + "<br>" + r.status).addTo(layer));
  if (here) L.circleMarker(here, { radius: 8, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).bindPopup("You are here").addTo(layer);
}

// Admin: fill the evacuation center form with the current location
$("use-loc").addEventListener("click", () => {
  const err = $("center-form").querySelector(".error");
  if (!navigator.geolocation) { err.textContent = "Your browser cannot share location."; return; }
  navigator.geolocation.getCurrentPosition(p => {
    const el = $("center-form").elements;
    el.lat.value = p.coords.latitude.toFixed(5); el.lng.value = p.coords.longitude.toFixed(5); err.textContent = "";
  }, () => { err.textContent = "Location blocked or unavailable. Type the coordinates instead."; }, { timeout: 10000 });
});

// ---------- 9. Live alert notifications ----------
// When another tab (for example the admin) saves new data, this tab gets a "storage" event.
function toast(msg, level) {
  const t = $("toast"); t.textContent = msg; t.className = "toast lv" + level;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.add("hidden"), 7000);
}
window.addEventListener("storage", e => {
  if (e.key !== KEY || !me) return;
  const seen = db.alerts.filter(a => a.status === "published").map(a => a.id);
  db = load();
  me = db.users.find(u => u.id === me.id && u.active) || null;
  if (!me) { leave(); return; }
  db.alerts.filter(a => a.status === "published" && !seen.includes(a.id))
    .forEach(a => toast("New " + LV[a.level] + " alert: " + a.title, a.level));
  renderAll();
});

// ---------- 10. Start ----------
document.querySelectorAll(".types").forEach(s => s.insertAdjacentHTML("beforeend", TYPES.map(t => `<option>${t}</option>`).join("")));
document.querySelectorAll(".rtypes").forEach(s => s.insertAdjacentHTML("beforeend", RTYPES.map(t => `<option>${t}</option>`).join("")));
["f-q", "f-type", "f-status", "c-q", "r-q", "r-status"].forEach(id => $(id).addEventListener("input", renderAll));
// ---------- 11. Preparedness quiz ----------
// q = question, o = options, a = index of the correct option, why = explanation shown after answering
const QUIZ = [
  { q: "What should you do during an earthquake?", o: ["Run outside right away", "Drop, cover, and hold on", "Stand in a doorway", "Use the elevator"], a: 1,
    why: "Drop, cover, and hold on protects you from falling objects." },
  { q: "How much drinking water should you store per person each day?", o: ["1 liter", "3 liters", "10 liters", "None, tap water is enough"], a: 1,
    why: "Store about 3 liters per person per day, for at least 3 days." },
  { q: "Is it safe to walk or drive through floodwater?", o: ["Yes, if it is shallow", "Yes, if you wear boots", "Only at night", "No, avoid it"], a: 3,
    why: "Floodwater can hide holes, carry current, and may be electrified." },
  { q: "Which items belong in a go-bag?", o: ["Flashlight, first aid kit, copies of IDs", "A large television", "A full set of dishes", "Heavy furniture"], a: 0,
    why: "A go-bag holds light essentials you can grab quickly." },
  { q: "A fire starts in your home. What do you do?", o: ["Hide under the bed", "Go back for your belongings", "Get out, stay out, and call 911", "Open every window"], a: 2,
    why: "Get out and stay out. Call 911 once you are safe." }
];

function quizBest() {
  const b = db.quiz[me.id];
  $("quiz-best").textContent = b ? "Your best score: " + b.best + " of " + QUIZ.length : "You have not taken the quiz yet.";
}

function renderQuiz() {
  quizBest();
  $("quiz-qs").innerHTML = QUIZ.map((q, i) => `<fieldset><legend>${i + 1}. ${esc(q.q)}</legend>` +
    q.o.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}">${esc(o)}</label>`).join("") + "</fieldset>").join("");
  $("quiz-form").classList.remove("hidden");
  $("quiz-result").classList.add("hidden");
}

$("quiz-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, err = f.querySelector(".error");
  for (let i = 0; i < QUIZ.length; i++) {                      // every question must be answered
    if (!f.elements["q" + i].value) { err.textContent = "Answer question " + (i + 1) + " first."; return; }
  }
  err.textContent = "";
  let score = 0, html = "";
  QUIZ.forEach((q, i) => {
    const ok = Number(f.elements["q" + i].value) === q.a;
    if (ok) score++;
    html += `<p class="${ok ? "right" : "wrong"}"><b>${i + 1}. ${ok ? "Correct" : "Not quite"}.</b> ${esc(q.why)}</p>`;
  });
  const old = db.quiz[me.id] || { best: 0 };
  db.quiz[me.id] = { best: Math.max(old.best, score), last: score, time: now() };
  log("Took preparedness quiz: " + score + "/" + QUIZ.length); save(); quizBest();
  const msg = score === QUIZ.length ? "Perfect! You are ready." : score >= 3 ? "Good job. Review the Safety Guide for the rest." : "Read the Safety Guide, then try again.";
  $("quiz-result").innerHTML = `<h2>You scored ${score} of ${QUIZ.length}</h2><p>${msg}</p>${html}<button id="quiz-retry" class="btn alt">Try again</button>`;
  $("quiz-result").classList.remove("hidden");
  f.classList.add("hidden");
});
$("quiz-result").addEventListener("click", e => { if (e.target.id === "quiz-retry") renderQuiz(); });

// ---------- 12. Light / dark theme ----------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $("theme").textContent = t === "dark" ? "Light mode" : "Dark mode";
  try { localStorage.setItem("cdaps_theme", t); } catch (e) { /* storage blocked: theme just won't be remembered */ }
}
$("theme").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
let savedTheme = null;
try { savedTheme = localStorage.getItem("cdaps_theme"); } catch (e) { }
setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

if (me) enter(); else leave();
