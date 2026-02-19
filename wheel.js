function getISOWeekLabel(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const yyyy = date.getUTCFullYear();
  const ww = String(weekNo).padStart(2, "0");
  return `${yyyy}-W${ww}`;
}

let weekLabel = getISOWeekLabel();
document.getElementById("weekAdminLabel").textContent = `Week: ${weekLabel}`;

let names = [];
let spinning = false;
let angle = 0;
let velocity = 0;

const fileInput = document.getElementById("fileInput");
const spinBtn = document.getElementById("spinBtn");
const resetBtn = document.getElementById("resetBtn");
const dedupeToggle = document.getElementById("dedupe");

const loadedCount = document.getElementById("loadedCount");
const rConductor = document.getElementById("rConductor");
const rVip = document.getElementById("rVip");
const shareLink = document.getElementById("shareLink");
const copyBtn = document.getElementById("copyBtn");

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

function normalizeNameLine(text) {
  return text
    .split(/?
/)
    .flatMap(line => line.split(/[;,]/))
    .map(s => s.trim())
    .filter(Boolean);
}

fileInput.addEventListener("change", async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  const text = await f.text();
  let list = normalizeNameLine(text);

  if (dedupeToggle.checked) {
    const seen = new Set();
    list = list.filter(n => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  names = list;
  loadedCount.textContent = `${names.length} names`;
  spinBtn.disabled = names.length < 2;

  angle = 0;
  drawWheel();
});

const colors = ["#c9a37b", "#b58b63", "#d7c4ab", "#8f6e4c"];

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 10;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fill();

  if (names.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "bold 18px system-ui, Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Upload a name list first", cx, cy);
    return;
  }

  const slice = (Math.PI * 2) / names.length;

  for (let i = 0; i < names.length; i++) {
    const start = angle + i * slice;
    const end = start + slice;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f0f0f";
    ctx.font = "bold 16px system-ui, Segoe UI, Arial";
    const label = names[i].length > 18 ? names[i].slice(0, 18) + "…" : names[i];
    ctx.fillText(label, radius - 16, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(231,198,165,.95)";
  ctx.font = "900 14px system-ui, Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.fillText("SPIN", cx, cy + 5);
}

let audioCtx = null;
let clickGain = null;
let clickOsc = null;
let clickInterval = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startSpinSound() {
  ensureAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();

  clickGain = audioCtx.createGain();
  clickGain.gain.value = 0.0;
  clickGain.connect(audioCtx.destination);

  clickOsc = audioCtx.createOscillator();
  clickOsc.type = "square";
  clickOsc.frequency.value = 140;
  clickOsc.connect(clickGain);
  clickOsc.start();

  let t = 0;
  clickInterval = setInterval(() => {
    const v = Math.min(1, Math.max(0.15, velocity / 0.6));
    clickGain.gain.setTargetAtTime(0.12 * v, audioCtx.currentTime, 0.005);
    clickGain.gain.setTargetAtTime(0.0, audioCtx.currentTime + 0.03, 0.02);

    t += 1;
    clickOsc.frequency.setValueAtTime(130 + (t % 6) * 8, audioCtx.currentTime);
  }, 70);
}

function stopSpinSound() {
  if (clickInterval) clearInterval(clickInterval);
  clickInterval = null;
  if (clickOsc) { try { clickOsc.stop(); } catch {} }
  clickOsc = null;
  clickGain = null;
}

function playDing() {
  ensureAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = 880;
  g.gain.value = 0.0001;

  o.connect(g);
  g.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  o.frequency.setValueAtTime(880, now);
  o.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

  o.start(now);
  o.stop(now + 0.62);
}

function getConductorIndex() {
  const slice = (Math.PI * 2) / names.length;
  const pointerAngle = -Math.PI / 2;
  let a = (pointerAngle - angle) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return Math.floor(a / slice);
}

function pickVip(excludeIndex) {
  const pool = names.map((n, i) => ({ n, i })).filter(x => x.i !== excludeIndex);
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildShareURL(conductor, vip) {
  const base = location.origin + location.pathname.replace(/admin\.html$/, "index.html");
  const params = new URLSearchParams();
  params.set("week", weekLabel);
  params.set("c", encodeURIComponent(conductor));
  params.set("v", encodeURIComponent(vip));
  return `${base}?${params.toString()}`;
}

function spin() {
  if (spinning || names.length < 2) return;

  ensureAudio();

  spinning = true;
  spinBtn.disabled = true;
  copyBtn.disabled = true;
  shareLink.value = "(spinning...)";

  velocity = 0.55 + Math.random() * 0.35;

  const targetTime = 2600 + Math.random() * 900;
  const start = performance.now();

  startSpinSound();

  function animate(now) {
    const t = (now - start) / targetTime;
    const eased = 1 - Math.pow(1 - Math.min(1, t), 3);
    const decay = (1 - eased);

    angle += velocity * (0.45 + decay);
    velocity *= 0.992 - (eased * 0.003);

    drawWheel();

    if (t < 1) requestAnimationFrame(animate);
    else finalize();
  }

  function finalize() {
    let settleFrames = 30;
    function settle() {
      angle += velocity;
      velocity *= 0.94;
      drawWheel();
      if (--settleFrames > 0) requestAnimationFrame(settle);
      else done();
    }
    requestAnimationFrame(settle);
  }

  function done() {
    stopSpinSound();
    playDing();

    const cIdx = getConductorIndex();
    const conductor = names[cIdx];
    const vip = pickVip(cIdx).n;

    rConductor.textContent = conductor;
    rVip.textContent = vip;

    const url = buildShareURL(conductor, vip);
    shareLink.value = url;
    copyBtn.disabled = false;

    spinning = false;
    spinBtn.disabled = names.length < 2;
  }

  requestAnimationFrame(animate);
}

spinBtn.addEventListener("click", spin);

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  } catch {
    shareLink.select();
    document.execCommand("copy");
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  }
});

resetBtn.addEventListener("click", () => {
  weekLabel = getISOWeekLabel(new Date());
  document.getElementById("weekAdminLabel").textContent = `Week: ${weekLabel}`;

  rConductor.textContent = "—";
  rVip.textContent = "—";
  shareLink.value = "(the link will appear here after a spin)";
  copyBtn.disabled = true;

  angle = 0;
  drawWheel();
});

drawWheel();
