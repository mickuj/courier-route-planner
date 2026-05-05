import express from "express";
import { nearestNeighbor } from "../utils/tsp.js";

const router = express.Router();
const MAPBOX_BASE = "https://api.mapbox.com/directions/v5/mapbox/driving";
// Mapbox Directions supports up to 25 waypoints per request
const MAX_WAYPOINTS = 25;

/**
 * POST /api/route
 * Body: {
 *   start: { latitude, longitude },   // courier's current position
 *   points: [{ id, name, latitude, longitude, address, ... }]
 * }
 *
 * Returns:
 *   ordered: sorted point array with distFromPrev
 *   geometry: GeoJSON LineString for the full route
 *   duration: total seconds
 *   distance: total meters
 *   legs: per-segment durations/distances
 */
router.post("/", async (req, res) => {
  const { start, points } = req.body;

  if (!start?.latitude || !start?.longitude) {
    return res.status(400).json({ error: "start location is required" });
  }
  if (!Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ error: "points array is required and must not be empty" });
  }
  if (points.length > MAX_WAYPOINTS) {
    return res.status(400).json({
      error: `Too many points. Maximum is ${MAX_WAYPOINTS}.`,
    });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "MAPBOX_ACCESS_TOKEN is not configured on the server" });
  }

  try {
    // 1. Order points using nearest-neighbour heuristic
    const ordered = nearestNeighbor(start, points);

    // 2. Build waypoints string for Mapbox Directions
    //    Format: lng,lat;lng,lat;...
    const allWaypoints = [start, ...ordered];
    const coordStr = allWaypoints
      .map((p) => `${p.longitude},${p.latitude}`)
      .join(";");

    const url = new URL(`${MAPBOX_BASE}/${coordStr}`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "full");
    url.searchParams.set("steps", "false");
    url.searchParams.set("annotations", "duration,distance");

    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Mapbox API error ${resp.status}: ${text}`);
    }

    const data = await resp.json();

    if (!data.routes || data.routes.length === 0) {
      return res.status(422).json({ error: "Mapbox could not calculate a route for these points" });
    }

    const route = data.routes[0];

    // Build per-stop ETA from legs
    const legs = route.legs.map((leg, i) => ({
      from: i === 0 ? "start" : ordered[i - 1]?.name ?? `Point ${i}`,
      to: ordered[i]?.name ?? `Point ${i + 1}`,
      duration: leg.duration, // seconds
      distance: leg.distance, // meters
    }));

    res.json({
      ordered,
      geometry: route.geometry,
      duration: route.duration,
      distance: route.distance,
      legs,
    });
  } catch (err) {
    console.error("[route] error:", err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;
