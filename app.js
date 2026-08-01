import { auth, db, rtdb } from './firebase-config.js';
import { doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

/* ========================================================
   NOVASHIELD FRONTEND APPLICATION LOGIC
   Emergency Response & Telematics Platform
   ======================================================== */

const BlackBox = (() => {
  const activeAnimations = {};
  let currentUser = null;

  /* ---- Firebase Helpers ---- */
  async function loadRider() {
    if (!currentUser) return null;
    try {
      const snap = await getDoc(doc(db, "riders", currentUser.uid));
      return snap.exists() ? snap.data() : null;
    } catch (e) {
      console.error("[loadRider] Firestore error:", e);
      return null;
    }
  }

  function hideSplash() {
    const splash = document.getElementById('loading-splash');
    if (splash && splash.style.opacity !== '0') {
      splash.style.opacity = '0';
      setTimeout(() => { splash.parentNode && splash.parentNode.removeChild(splash); }, 500);
    }
  }

  /* ===================================================
     DASHBOARD PAGE SETUP
     =================================================== */
  function setupDashboard() {
    setTimeout(hideSplash, 6000);

    /* ---- Tab Switching Logic ---- */
    const tabs = document.querySelectorAll('.dash-tab');
    const views = document.querySelectorAll('.dash-view');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetViewId = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));

        tab.classList.add('active');
        const targetView = document.getElementById(targetViewId);
        if (targetView) targetView.classList.add('active');

        // Resize maps when switching tabs so Leaflet renders correctly
        setTimeout(() => {
          if (riderMap) riderMap.invalidateSize();
          if (parentMap) parentMap.invalidateSize();
          if (policeMap) policeMap.invalidateSize();
        }, 200);
      });
    });

    /* ---- Live telemetry state ---- */
    const live = { speed: 0, lean: 0, g: 0.0, batt: 87 };

    function setLive() {
      const speedEl = document.getElementById('live-speed');
      const leanEl = document.getElementById('live-lean');
      const gEl = document.getElementById('live-g');
      const battValEl = document.getElementById('batt-val');
      const battBarEl = document.getElementById('batt-bar');

      if (speedEl) speedEl.textContent = live.speed;
      if (leanEl) leanEl.textContent = live.lean + '°';
      if (gEl) gEl.textContent = live.g.toFixed(1) + 'G';
      if (battValEl) battValEl.textContent = live.batt + '%';
      if (battBarEl) battBarEl.style.width = live.batt + '%';
    }

    /* ---- Crash & Emergency Simulation State ---- */
    let isCrashed = false;
    let crashTimer = null;
    let countdownVal = 10;

    /* Maps */
    let riderMap = null, parentMap = null, policeMap = null;
    let riderMarker = null, parentMarker = null, policeMarker = null;
    const startPos = { lat: 29.3909, lng: 76.9635 };
    let currentPos = { ...startPos };

    /* Logs */
    const logEl = document.getElementById('event-log');
    const SEED_LOGS = [
      { t: '14:02:11', m: 'GPS lock acquired · ±2.1m accuracy', type: 'info' },
      { t: '14:01:58', m: 'IMU 6-axis calibration normal', type: 'info' },
      { t: '14:01:32', m: 'Hard braking event logged', type: 'warning' },
      { t: '14:00:47', m: 'GSM SIM800L connection online', type: 'info' },
      { t: '14:00:12', m: 'Ride started · BlackBox armed', type: 'info' },
    ];
    let logs = [...SEED_LOGS];

    function renderLog(list) {
      if (!logEl) return;
      logEl.innerHTML = '';
      list.forEach(l => {
        const div = document.createElement('div');
        div.style.padding = '8px 12px';
        div.style.borderRadius = '6px';
        div.style.background = 'var(--bg)';
        div.style.borderLeft = l.type === 'alert' ? '3px solid var(--emergency)' : l.type === 'warning' ? '3px solid var(--warning)' : '3px solid var(--accent)';

        div.innerHTML = `<span style="color:var(--text-muted); font-size:0.75rem;">${l.t}</span> <span style="margin-left:8px; color:var(--text);">${l.m}</span>`;
        logEl.appendChild(div);
      });
    }
    renderLog(logs);

    /* ---- Crash Trigger (Emergency Mode) ---- */
    const overlay = document.getElementById('crash-overlay');
    const countdownEl = document.getElementById('crash-countdown');
    const simBtn = document.getElementById('sim-crash-btn');
    const cancelSosBtn = document.getElementById('cancel-sos-btn');

    function triggerCrashAlert() {
      isCrashed = 'alerting';
      live.speed = 0; live.lean = 85; live.g = 5.4;
      setLive();

      // Update System Badge
      const sysStatusDot = document.getElementById('system-status-dot');
      const sysStatusText = document.getElementById('system-status-text');
      if (sysStatusDot) sysStatusDot.className = 'status-dot status-dot-red';
      if (sysStatusText) sysStatusText.textContent = '⚠ ACCIDENT DETECTED · ALERTING';

      // Update Parent Dashboard Status Card
      const parentCard = document.getElementById('parent-status-card');
      const parentIcon = document.getElementById('parent-status-icon');
      const parentText = document.getElementById('parent-status-text');
      const parentSub = document.getElementById('parent-status-sub');
      if (parentCard) { parentCard.className = 'parent-status-card alert'; }
      if (parentIcon) parentIcon.textContent = '🚨';
      if (parentText) parentText.textContent = 'ACCIDENT DETECTED!';
      if (parentSub) parentSub.textContent = 'Impact force 5.4G detected. Emergency services notified.';

      // Update Timeline Dots
      const tlCrashDot = document.getElementById('tl-crash-dot');
      const tlCrashText = document.getElementById('tl-crash-text');
      const tlSosDot = document.getElementById('tl-sos-dot');
      const tlSosText = document.getElementById('tl-sos-text');
      const tlAmbDot = document.getElementById('tl-amb-dot');
      const tlAmbText = document.getElementById('tl-amb-text');

      if (tlCrashDot) { tlCrashDot.className = 'timeline-dot emergency'; }
      if (tlCrashText) tlCrashText.textContent = 'Impact 5.4G at 14:02:11';
      if (tlSosDot) { tlSosDot.className = 'timeline-dot active'; }
      if (tlSosText) tlSosText.textContent = 'Dispatching SMS & Calls...';

      // Show Emergency Overlay
      if (overlay) overlay.classList.add('show');

      countdownVal = 10;
      if (countdownEl) countdownEl.textContent = countdownVal;

      const timeStr = new Date().toTimeString().slice(0, 8);
      logs = [{ t: timeStr, m: '⚠ CRASH DETECTED! High G-force impact logged.', type: 'alert' }, ...logs].slice(0, 10);
      renderLog(logs);

      crashTimer = setInterval(() => {
        countdownVal--;
        if (countdownEl) countdownEl.textContent = countdownVal;
        if (countdownVal <= 0) {
          clearInterval(crashTimer);
          triggerSOSDispatch();
        }
      }, 1000);
    }

    function triggerSOSDispatch() {
      isCrashed = 'dispatched';
      const sysStatusText = document.getElementById('system-status-text');
      if (sysStatusText) sysStatusText.textContent = '🚑 SOS DISPATCHED · SERVICES NOTIFIED';

      const tlSosDot = document.getElementById('tl-sos-dot');
      const tlSosText = document.getElementById('tl-sos-text');
      const tlAmbDot = document.getElementById('tl-amb-dot');
      const tlAmbText = document.getElementById('tl-amb-text');

      if (tlSosDot) tlSosDot.className = 'timeline-dot completed';
      if (tlSosText) tlSosText.textContent = 'Sent to Family, Police & Hospital';
      if (tlAmbDot) tlAmbDot.className = 'timeline-dot emergency';
      if (tlAmbText) tlAmbText.textContent = 'En route · ETA 8 mins';

      const timeStr = new Date().toTimeString().slice(0, 8);
      logs = [
        { t: timeStr, m: '🚑 Ambulance 108 & Police 112 Dispatched with GPS location.', type: 'alert' },
        ...logs
      ].slice(0, 10);
      renderLog(logs);

      if (simBtn) simBtn.textContent = '⚡ Reset System';
    }

    function resetSystem() {
      isCrashed = false;
      if (overlay) overlay.classList.remove('show');

      const sysStatusDot = document.getElementById('system-status-dot');
      const sysStatusText = document.getElementById('system-status-text');
      if (sysStatusDot) sysStatusDot.className = 'status-dot status-dot-green';
      if (sysStatusText) sysStatusText.textContent = 'System Armed · Safe';

      const parentCard = document.getElementById('parent-status-card');
      const parentIcon = document.getElementById('parent-status-icon');
      const parentText = document.getElementById('parent-status-text');
      const parentSub = document.getElementById('parent-status-sub');
      if (parentCard) parentCard.className = 'parent-status-card safe';
      if (parentIcon) parentIcon.textContent = '🛡️';
      if (parentText) parentText.textContent = 'RIDER IS SAFE';
      if (parentSub) parentSub.textContent = 'No accident or crash detected. Normal riding parameters.';

      const tlCrashDot = document.getElementById('tl-crash-dot');
      const tlCrashText = document.getElementById('tl-crash-text');
      const tlSosDot = document.getElementById('tl-sos-dot');
      const tlSosText = document.getElementById('tl-sos-text');
      const tlAmbDot = document.getElementById('tl-amb-dot');
      const tlAmbText = document.getElementById('tl-amb-text');

      if (tlCrashDot) tlCrashDot.className = 'timeline-dot pending';
      if (tlCrashText) tlCrashText.textContent = 'No crash detected';
      if (tlSosDot) tlSosDot.className = 'timeline-dot pending';
      if (tlSosText) tlSosText.textContent = 'Standby';
      if (tlAmbDot) tlAmbDot.className = 'timeline-dot pending';
      if (tlAmbText) tlAmbText.textContent = 'Standby';

      if (simBtn) simBtn.textContent = '⚡ Simulate Crash';

      live.speed = 0; live.lean = 0; live.g = 0.0;
      setLive();

      const timeStr = new Date().toTimeString().slice(0, 8);
      logs = [{ t: timeStr, m: '✓ System reset. Telemetry normalized.', type: 'info' }, ...logs].slice(0, 10);
      renderLog(logs);
    }

    if (simBtn) {
      simBtn.addEventListener('click', () => {
        if (isCrashed) resetSystem();
        else triggerCrashAlert();
      });
    }

    if (cancelSosBtn) {
      cancelSosBtn.addEventListener('click', () => {
        if (crashTimer) clearInterval(crashTimer);
        resetSystem();
      });
    }

    /* ---- Update Rider Profile in UI ---- */
    function updateDashboardUI(r) {
      const avatar = document.getElementById('avatar');
      const riderName = document.getElementById('rider-name');
      const statBlood = document.getElementById('stat-blood');
      const statAge = document.getElementById('stat-age');
      const statEmg = document.getElementById('stat-emg');
      const crashEmgNum = document.getElementById('crash-emg-num');
      const parentBlood = document.getElementById('parent-blood');

      if (avatar) avatar.textContent = (r.name || 'R').slice(0, 1).toUpperCase();
      if (riderName) riderName.textContent = r.name || 'Rider';
      if (statBlood) statBlood.textContent = r.bloodGroup || 'O+';
      if (parentBlood) parentBlood.textContent = r.bloodGroup || 'O+';
      if (statAge) statAge.textContent = r.age || '27';
      if (statEmg) statEmg.textContent = r.emergency || '+91 90000 00000';
      if (crashEmgNum) crashEmgNum.textContent = `Alerting ${r.emergency || '+91 90000 00000'}`;
    }

    /* ---- Auth listener & Real-time listeners ---- */
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      currentUser = user;

      const r = await loadRider() || { name: 'Rider', age: '27', bloodGroup: 'O+', emergency: '+91 90000 00000' };
      updateDashboardUI(r);

      onSnapshot(doc(db, "riders", user.uid), (snap) => {
        if (snap.exists()) updateDashboardUI(snap.data());
      });

      /* ESP32 Realtime Database Listener */
      const telemetryRef = ref(rtdb, `telemetry/${user.uid}`);
      onValue(telemetryRef, (snapshot) => {
        hideSplash();
        if (!snapshot.exists()) return;
        const data = snapshot.val();

        if (!isCrashed) {
          live.speed = data.speed ?? 0;
          live.lean = data.lean ?? 0;
          live.g = data.gforce ?? 0.0;
          if (data.battery !== undefined) live.batt = data.battery;

          if (data.lat && data.lng) {
            currentPos.lat = data.lat;
            currentPos.lng = data.lng;
            if (riderMarker) riderMarker.setLatLng([data.lat, data.lng]);
            if (parentMarker) parentMarker.setLatLng([data.lat, data.lng]);
            if (policeMarker) policeMarker.setLatLng([data.lat, data.lng]);
          }

          if (data.crash_detected && !isCrashed) {
            triggerCrashAlert();
          } else {
            setLive();
          }
        }
      });
    });

    /* Logout Button */
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => { window.location.href = 'index.html'; });
      });
    }

    /* Maps Initialization */
    function initMaps() {
      if (!window.L) return;

      const mapOptions = { zoomControl: true, attributionControl: false };
      const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      // Rider Map
      const mapDiv = document.getElementById('map');
      if (mapDiv) {
        riderMap = L.map('map', mapOptions).setView([currentPos.lat, currentPos.lng], 15);
        L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(riderMap);
        riderMarker = L.marker([currentPos.lat, currentPos.lng]).addTo(riderMap);
      }

      // Parent Map
      const parentMapDiv = document.getElementById('parent-map');
      if (parentMapDiv) {
        parentMap = L.map('parent-map', mapOptions).setView([currentPos.lat, currentPos.lng], 15);
        L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(parentMap);
        parentMarker = L.marker([currentPos.lat, currentPos.lng]).addTo(parentMap);
      }

      // Police Map
      const policeMapDiv = document.getElementById('police-map');
      if (policeMapDiv) {
        policeMap = L.map('police-map', mapOptions).setView([currentPos.lat, currentPos.lng], 15);
        L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(policeMap);
        policeMarker = L.marker([currentPos.lat, currentPos.lng]).addTo(policeMap);
      }
    }

    /* Charts */
    drawRideChart();
    drawWeekChart();
    initMaps();
    setLive();
  }

  /* ---- Chart Functions (Clean Canvas Drawing) ---- */
  function drawRideChart() {
    const canvas = document.getElementById('ride-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = 200;
    ctx.clearRect(0, 0, w, h);

    // Draw background grid lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = (h / 4) * i;
      ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(w - 10, y); ctx.stroke();
    }

    // Speed curve (blue)
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const data = [10, 25, 42, 55, 60, 52, 48, 65, 70, 58, 40, 30, 20, 0];
    const step = (w - 40) / (data.length - 1);

    data.forEach((val, i) => {
      const x = 30 + i * step;
      const y = h - 30 - (val / 80) * (h - 50);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function drawWeekChart() {
    const canvas = document.getElementById('week-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = 160;
    ctx.clearRect(0, 0, w, h);

    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const vals = [25, 40, 18, 55, 32, 70, 12];
    const bw = (w - 40) / days.length - 8;

    vals.forEach((v, i) => {
      const x = 20 + i * (bw + 8);
      const bh = (v / 80) * (h - 40);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(x, h - 25 - bh, bw, bh);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(days[i], x + bw / 3, h - 8);
    });
  }

  return { setupDashboard };
})();

export default BlackBox;
