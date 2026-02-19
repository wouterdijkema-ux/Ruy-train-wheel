// RUY Admin Wheel (robust rewrite)

function getISOWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

let weekLabel = getISOWeekLabel();
const weekAdminLabel = document.getElementById('weekAdminLabel');
weekAdminLabel.textContent = `Week: ${weekLabel}`;

const fileInput = document.getElementById('fileInput');
const dedupeToggle = document.getElementById('dedupe');
const loadedCount = document.getElementById('loadedCount');

const spinBtn = document.getElementById('spinBtn');
const resetBtn = document.getElementById('resetBtn');

const rConductor = document.getElementById('rConductor');
const rVip = document.getElementById('rVip');

const shareLink = document.getElementById('shareLink');
const copyBtn = document.getElementById('copyBtn');

const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');

let names = [];
let spinning = false;
let angle = 0;
let velocity = 0;
let rafId = null;

const colors = ['#c9a37b', '#b58b63', '#d7c4ab', '#8f6e4c'];

function stripBOM(text) {
  return text.replace(/^﻿/, '');
}

function parseNames(text) {
  text = stripBOM(text);
  text = text.replace(/
/g, '
').replace(//g, '
');
  const lines = text.split('
');
  const parts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tokens = trimmed
      .split(/[;,]/g)
      .map(s => s.trim())
      .map(s => s.replace(/^"(.*)"$/, '$1'))
      .map(s => s.replace(/^'(.*)'$/, '$1'))
      .filter(Boolean);
    parts.push(...tokens);
  }
  return parts
    .map(n => n.replace(/,+$/, '').trim())
    .filter(Boolean);
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const n of list) {
    const k = n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(n);
  }
  return out;
}

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 12;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fill();

  if (names.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = '700 18px system-ui, Segoe UI, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Upload a name list first', cx, cy);
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
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f0f0f';
    ctx.font = '800 16px system-ui, Segoe UI, Arial';
    const label = names[i].length > 18 ? names[i].slice(0, 18) + '…' : names[i];
    ctx.fillText(label, radius - 18, 6);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(231,198,165,.95)';
  ctx.font = '900 14px system-ui, Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SPIN', cx, cy + 5);
}

function getWinnerIndex() {
  const slice = (Math.PI * 2) / names.length;
  const pointerAngle = -Math.PI / 2;
  let a = (pointerAngle - angle) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return Math.floor(a / slice);
}

function pickSecondWinner(excludeIndex) {
  const pool = names.map((n, i) => ({ n, i })).filter(x => x.i !== excludeIndex);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Audio
let audioCtx = null;
let clickOsc = null;
let clickGain = null;
let clickTimer = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startClickSound() {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  clickGain = audioCtx.createGain();
  clickGain.gain.value = 0;
  clickGain.connect(audioCtx.destination);

  clickOsc = audioCtx.createOscillator();
  clickOsc.type = 'square';
  clickOsc.frequency.value = 140;
  clickOsc.connect(clickGain);
  clickOsc.start();

  clickTimer = setInterval(() => {
    const v = Math.min(1, Math.max(0.15, velocity / 0.6));
    const now = audioCtx.currentTime;
    clickGain.gain.cancelScheduledValues(now);
    clickGain.gain.setValueAtTime(0, now);
    clickGain.gain.linearRampToValueAtTime(0.12 * v, now + 0.01);
    clickGain.gain.linearRampToValueAtTime(0, now + 0.06);
    clickOsc.frequency.setValueAtTime(130 + Math.random() * 30, now);
  }, 75);
}

function stopClickSound() {
  if (clickTimer) clearInterval(clickTimer);
  clickTimer = null;
  if (clickOsc) {
    try { clickOsc.stop(); } catch {}
  }
  clickOsc = null;
  clickGain = null;
}

function playDing() {
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 880;
  g.gain.value = 0.0001;

  o.connect(g);
  g.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  o.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

  o.start(now);
  o.stop(now + 0.7);
}

function buildShareUrl(trainConductor, vipPassenger) {
  const url = new URL('index.html', location.href);
  url.searchParams.set('week', weekLabel);
  url.searchParams.set('tc', trainConductor);
  url.searchParams.set('vp', vipPassenger);
  return url.toString();
}

function spin() {
  if (spinning || names.length < 2) return;

  ensureAudio();

  spinning = true;
  spinBtn.disabled = true;
  copyBtn.disabled = true;
  shareLink.value = '(spinning...)';

  velocity = 0.70 + Math.random() * 0.35;
  const duration = 2800 + Math.random() * 900;
  const start = performance.now();

  startClickSound();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const damp = 0.995 - ease * 0.008;

    angle += velocity;
    velocity *= damp;

    drawWheel();

    if (t < 1) rafId = requestAnimationFrame(tick);
    else settle(26);
  }

  function settle(frames) {
    angle += velocity;
    velocity *= 0.92;
    drawWheel();

    if (frames > 0) rafId = requestAnimationFrame(() => settle(frames - 1));
    else finish();
  }

  function finish() {
    stopClickSound();
    playDing();

    const idx = getWinnerIndex();
    const conductor = names[idx];
    const vip = pickSecondWinner(idx).n;

    rConductor.textContent = conductor;
    rVip.textContent = vip;

    const url = buildShareUrl(conductor, vip);
    shareLink.value = url;
    copyBtn.disabled = false;

    spinning = false;
    spinBtn.disabled = names.length < 2;
  }

  rafId = requestAnimationFrame(tick);
}

fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0];
  if (!f) return;

  const text = await f.text();
  let list = parseNames(text);
  if (dedupeToggle.checked) list = dedupe(list);

  names = list;
  loadedCount.textContent = `${names.length} names`;
  spinBtn.disabled = names.length < 2;

  angle = 0;
  rConductor.textContent = '—';
  rVip.textContent = '—';
  shareLink.value = '(the link will appear here after a spin)';
  copyBtn.disabled = true;

  drawWheel();
});

spinBtn.addEventListener('click', spin);

copyBtn.addEventListener('click', async () => {
  const text = shareLink.value;
  if (!text || text.startsWith('(')) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  } catch {
    shareLink.focus();
    shareLink.select();
    document.execCommand('copy');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  }
});

resetBtn.addEventListener('click', () => {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  stopClickSound();

  weekLabel = getISOWeekLabel(new Date());
  weekAdminLabel.textContent = `Week: ${weekLabel}`;

  rConductor.textContent = '—';
  rVip.textContent = '—';
  shareLink.value = '(the link will appear here after a spin)';
  copyBtn.disabled = true;

  angle = 0;
  drawWheel();
});

drawWheel();
