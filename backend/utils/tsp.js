/**
 * Haversine distance between two lat/lng points (in km)
 */
export function haversine(a, b) {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Nearest-neighbour heuristic for TSP.
 * start: { latitude, longitude }
 * points: [{ latitude, longitude, ...rest }]
 * Returns ordered array of points.
 */
export function nearestNeighbor(start, points) {
  if (points.length === 0) return [];

  const unvisited = [...points];
  const route = [];
  let current = start;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = haversine(current, unvisited[0]);

    for (let i = 1; i < unvisited.length; i++) {
      const d = haversine(current, unvisited[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    const [next] = unvisited.splice(nearestIdx, 1);
    route.push({ ...next, distFromPrev: nearestDist });
    current = next;
  }

  return route;
}
