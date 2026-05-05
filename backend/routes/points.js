import express from "express";

const router = express.Router();
const INPOST_BASE = "https://api-global-points.easypack24.net/v1/points";

/**
 * GET /api/points?city=Warszawa&country=PL
 *
 * Fetches ALL parcel lockers for a given city by iterating through
 * all pages of the InPost API. Only returns Operating parcel_locker points.
 */
router.get("/", async (req, res) => {
  const city = req.query.city?.trim();
  const country = req.query.country || "PL";

  if (!city) {
    return res.status(400).json({ error: "city query parameter is required" });
  }

  try {
    const points = await fetchAllPoints(city, country);
    res.json({ count: points.length, points });
  } catch (err) {
    console.error("[points] fetch error:", err.message);
    res.status(502).json({ error: "Failed to fetch InPost data", detail: err.message });
  }
});

async function fetchAllPoints(city, country) {
  const allPoints = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(INPOST_BASE);
    url.searchParams.set("city", city);
    url.searchParams.set("country_code", country);
    url.searchParams.set("page", page);
    url.searchParams.set("per_page", perPage);
    url.searchParams.set("type", "parcel_locker");

    const resp = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      throw new Error(`InPost API returned ${resp.status}`);
    }

    const data = await resp.json();

    // The InPost API returns items in `items` key
    const items = data.items ?? data.points ?? [];

    const operating = items.filter(
      (p) =>
        p.status === "Operating" &&
        p.location?.latitude &&
        p.location?.longitude
    );

    allPoints.push(
      ...operating.map((p) => ({
        id: p.name,
        name: p.name,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        address: `${p.address?.line1 ?? ""}, ${p.address?.line2 ?? ""}`.trim().replace(/^,|,$/g, ""),
        street: p.address_details?.street ?? "",
        buildingNumber: p.address_details?.building_number ?? "",
        city: p.address_details?.city ?? city,
        locationType: p.location_type ?? "",
        locationDescription: p.location_description ?? "",
        openingHours: p.opening_hours ?? "",
        is247: p.location_247 ?? false,
        lockerAvailability: p.locker_availability?.status ?? "NO_DATA",
      }))
    );

    // Check if there are more pages
    const total = data.total_count ?? data.count ?? items.length;
    const totalPages = Math.ceil(total / perPage);

    if (page >= totalPages || items.length < perPage) break;
    page++;
  }

  return allPoints;
}

export default router;
