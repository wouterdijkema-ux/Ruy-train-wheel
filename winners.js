(function () {
  const qs = new URLSearchParams(location.search);

  const week = qs.get("week");
  const c = qs.get("c");
  const v = qs.get("v");

  const conductorEl = document.getElementById("conductorName");
  const vipEl = document.getElementById("vipName");
  const weekEl = document.getElementById("weekLabel");

  if (week) weekEl.textContent = `Week: ${week}`;

  const decode = (x) => x ? decodeURIComponent(x) : null;

  const conductor = decode(c);
  const vip = decode(v);

  if (conductor && vip) {
    conductorEl.textContent = conductor;
    vipEl.textContent = vip;
    localStorage.setItem("ruyWeekly", JSON.stringify({ week, conductor, vip, ts: Date.now() }));
  } else {
    const saved = localStorage.getItem("ruyWeekly");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.week) weekEl.textContent = `Week: ${data.week}`;
        conductorEl.textContent = data.conductor || "Not drawn yet";
        vipEl.textContent = data.vip || "Not drawn yet";
      } catch {}
    } else {
      conductorEl.textContent = "Not drawn yet";
      vipEl.textContent = "Not drawn yet";
    }
  }
})();
