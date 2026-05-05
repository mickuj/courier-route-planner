import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const ROUTE_SOURCE = "route-source";
const ROUTE_LAYER  = "route-layer";

function makeMarkerEl(label, isStart = false) {
  const el = document.createElement("div");
  el.style.cssText = `
    width: ${isStart ? 14 : 28}px;
    height: ${isStart ? 14 : 28}px;
    border-radius: 50%;
    background: ${isStart ? "#2ECC71" : "#FFD600"};
    border: 2px solid #0B0C0E;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "JetBrains Mono", monospace;
    font-size: 10px;
    font-weight: 700;
    color: #000;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.6);
    flex-shrink: 0;
  `;
  if (!isStart) el.textContent = label;
  return el;
}

export default function MapView({ points, route, start, visitedIds, pickingStart, onMapPick }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);

  // Initialise map once
  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [19.94, 50.06], // Kraków default
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    mapRef.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    mapRef.current.on("click", (e) => {
      if (mapRef.current._pickActive && mapRef.current._onPick) {
        mapRef.current._onPick(e.lngLat);
      }
    });

    mapRef.current.on("load", () => {
      mapRef.current.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      mapRef.current.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#FFD600",
          "line-width": 3,
          "line-opacity": 0.85,
          "line-dasharray": [1, 0],
        },
      });
    });
  }, []);

  // Sync pick mode into map instance
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map._pickActive = pickingStart;
    map._onPick     = onMapPick;
    map.getCanvas().style.cursor = pickingStart ? "crosshair" : "";
  }, [pickingStart, onMapPick]);

  // Update markers when points change (selection or route order)
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ready = () => {
      clearMarkers();

      const displayPoints = route?.ordered ?? points;
      if (!displayPoints?.length) return;

      const bounds = new mapboxgl.LngLatBounds();

      // Start position marker
      if (start) {
        const el = makeMarkerEl("", true);
        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setHTML(
          `<div class="popup-name">📍 Start</div>
           <div class="popup-addr">${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}</div>`
        );
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([start.longitude, start.latitude])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
        bounds.extend([start.longitude, start.latitude]);
      }

      displayPoints.forEach((p, i) => {
        const isVisited = visitedIds?.has(p.id);
        const el = makeMarkerEl(i + 1);
        if (isVisited) {
          el.style.background = "#363840";
          el.style.color = "#6B7080";
        }

        const legInfo = route?.legs?.[i]
          ? `<div class="popup-order">~${fmtDuration(route.legs[i].duration)} · ${fmtDist(route.legs[i].distance)}</div>`
          : "";

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(
          `<div class="popup-name">${p.name}</div>
           <div class="popup-addr">${p.address}</div>
           <div class="popup-order">Stop #${i + 1}${isVisited ? " · ✓ Odwiedzony" : ""}</div>
           ${legInfo}`
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([p.longitude, p.latitude])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([p.longitude, p.latitude]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      }
    };

    if (map.loaded()) ready();
    else map.once("load", ready);
  }, [points, route, start, visitedIds, clearMarkers]);

  // Draw/clear route polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const source = map.getSource(ROUTE_SOURCE);
      if (!source) return;

      if (route?.geometry) {
        source.setData({
          type: "Feature",
          geometry: route.geometry,
        });
      } else {
        source.setData({ type: "FeatureCollection", features: [] });
      }
    };

    if (map.loaded()) update();
    else map.once("load", update);
  }, [route]);

  return (
    <div className="map-container">
      <div id="map" ref={containerRef} />
    </div>
  );
}

// ── helpers ──
function fmtDuration(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function fmtDist(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
