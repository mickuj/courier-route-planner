const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchPoints(city) {
  const res = await fetch(
    `${BASE}/api/points?city=${encodeURIComponent(city)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json(); // { count, points }
}

export async function fetchRoute(start, points) {
  const res = await fetch(`${BASE}/api/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, points }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json(); // { ordered, geometry, duration, distance, legs }
}
