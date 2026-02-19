(() => {
  const qs = new URLSearchParams(location.search);

  const week = qs.get('week');
  const conductor = qs.get('tc');
  const vip = qs.get('vp');

  const conductorEl = document.getElementById('conductorName');
  const vipEl = document.getElementById('vipName');
  const weekEl = document.getElementById('weekLabel');

  if (week) weekEl.textContent = `Week: ${week}`;

  if (conductor && vip) {
    conductorEl.textContent = conductor;
    vipEl.textContent = vip;
    localStorage.setItem('ruyWeekly', JSON.stringify({ week, conductor, vip, ts: Date.now() }));
    return;
  }

  const saved = localStorage.getItem('ruyWeekly');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.week) weekEl.textContent = `Week: ${data.week}`;
      conductorEl.textContent = data.conductor || 'Not drawn yet';
      vipEl.textContent = data.vip || 'Not drawn yet';
      return;
    } catch {}
  }

  conductorEl.textContent = 'Not drawn yet';
  vipEl.textContent = 'Not drawn yet';
})();
