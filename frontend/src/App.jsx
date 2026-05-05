import { useState, useMemo, useCallback } from "react";
import MapView from "./components/MapView.jsx";
import PointsList from "./components/PointsList.jsx";
import RoutePanel from "./components/RoutePanel.jsx";
import { fetchPoints, fetchRoute } from "./api/client.js";
import { useGeolocation } from "./hooks/useGeolocation.js";

const POPULAR_CITIES = [
  "Warszawa", "Kraków", "Wrocław", "Poznań", "Gdańsk",
  "Łódź", "Katowice", "Lublin", "Szczecin", "Białystok",
];

// startMode: "gps" | "map"
export default function App() {
  const [city, setCity]         = useState("Kraków");
  const [points, setPoints]     = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [route, setRoute]       = useState(null);
  const [start, setStart]       = useState(null);

  const [startMode, setStartMode]       = useState("gps");    // "gps" | "map"
  const [manualStart, setManualStart]   = useState(null);     // {lat,lng} picked on map
  const [pickingStart, setPickingStart] = useState(false);    // map is in pick-mode

  const [loadingPoints, setLoadingPoints] = useState(false);
  const [loadingRoute,  setLoadingRoute]  = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [errorPoints, setErrorPoints]     = useState(null);
  const [errorRoute,  setErrorRoute]      = useState(null);

  const { position, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  // ── Fetch points ──────────────────────────────────────────────────────────
  const handleFetchPoints = useCallback(async () => {
    if (!city.trim()) return;
    setLoadingPoints(true);
    setErrorPoints(null);
    setPoints([]);
    setSelected(new Set());
    setRoute(null);

    try {
      const data = await fetchPoints(city.trim());
      setPoints(data.points);
      if (data.points.length === 0) {
        setErrorPoints("Nie znaleziono paczkomatów dla tego miasta. Sprawdź pisownię.");
      }
    } catch (e) {
      setErrorPoints(e.message);
    } finally {
      setLoadingPoints(false);
    }
  }, [city]);

  // ── Toggle selection ──────────────────────────────────────────────────────
  const togglePoint = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids.slice(0, 25)) next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set()), []);

  // ── Start mode helpers ────────────────────────────────────────────────────
  const handleStartModeChange = useCallback((mode) => {
    setStartMode(mode);
    setPickingStart(false);
    if (mode === "gps" && !position) getPosition();
  }, [position, getPosition]);

  const handleActivatePick = useCallback(() => {
    setPickingStart(true);
  }, []);

  // Called by MapView when user clicks the map while in pick-mode
  const handleMapPick = useCallback((lngLat) => {
    setManualStart({ latitude: lngLat.lat, longitude: lngLat.lng });
    setPickingStart(false);
  }, []);

  // ── Effective start position ──────────────────────────────────────────────
  const effectiveStart = useMemo(() => {
    if (startMode === "gps") return position;
    return manualStart;
  }, [startMode, position, manualStart]);

  // ── Compute route ─────────────────────────────────────────────────────────
  const selectedPoints = useMemo(
    () => points.filter((p) => selected.has(p.id)),
    [points, selected]
  );

  const computeRoute = useCallback(async (startPos, pts) => {
    setLoadingRoute(true);
    setErrorRoute(null);
    try {
      const data = await fetchRoute(startPos, pts);
      setRoute(data);
      setStart(startPos);
    } catch (e) {
      setErrorRoute(e.message);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  const handleCalculate = useCallback(async () => {
    let startPos = effectiveStart;

    // Last resort fallback: centroid of selected points
    if (!startPos) {
      const avgLat = selectedPoints.reduce((s, p) => s + p.latitude, 0) / selectedPoints.length;
      const avgLng = selectedPoints.reduce((s, p) => s + p.longitude, 0) / selectedPoints.length;
      startPos = { latitude: avgLat, longitude: avgLng };
    }

    await computeRoute(startPos, selectedPoints);
  }, [selectedPoints, effectiveStart, computeRoute]);

  // ── Recalculate from now ──────────────────────────────────────────────────
  const handleRecalculate = useCallback(async (remainingPoints) => {
    setRecalcLoading(true);
    setErrorRoute(null);
    try {
      if (startMode === "gps") {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const newStart = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              const data = await fetchRoute(newStart, remainingPoints);
              setRoute(data);
              setStart(newStart);
              resolve();
            },
            async () => {
              const data = await fetchRoute(start, remainingPoints);
              setRoute(data);
              resolve();
            },
            { timeout: 8_000 }
          );
        });
      } else {
        // Re-use the last known start (manual)
        const data = await fetchRoute(start, remainingPoints);
        setRoute(data);
      }
    } catch (e) {
      setErrorRoute(e.message);
    } finally {
      setRecalcLoading(false);
    }
  }, [start, startMode]);

  const visitedIds = useMemo(() => new Set(), []);
  const showRoute = route && !loadingRoute;

  // ── Start readiness for button ────────────────────────────────────────────
  const startReady = startMode === "gps" ? !!position : !!manualStart;
  const startLabel = startMode === "gps"
    ? (position ? `📍 GPS: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}` : null)
    : (manualStart ? `📍 Ręczny: ${manualStart.latitude.toFixed(4)}, ${manualStart.longitude.toFixed(4)}` : null);

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="header">
        <div className="header__logo">Route<span>Post</span></div>
        <span className="header__sub">Planer tras kurierskich · InPost</span>
        {startLabel && (
          <div className="header__status" style={{ marginLeft: "auto" }}>
            <div className="status-dot" />
            <span className="mono" style={{ fontSize: 11 }}>{startLabel}</span>
          </div>
        )}
      </header>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar">
        {/* City selector */}
        <div className="sidebar__section">
          <div className="section__label">Miasto</div>
          <div className="input-row">
            <input
              list="cities-list"
              className="input"
              placeholder="np. Zamość"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchPoints()}
            />
            <datalist id="cities-list">
              {POPULAR_CITIES.map((c) => <option key={c} value={c} />)}
            </datalist>
            <button
              className="btn btn--primary"
              onClick={handleFetchPoints}
              disabled={loadingPoints || !city.trim()}
            >
              {loadingPoints ? "…" : "Szukaj"}
            </button>
          </div>
          {errorPoints && <div className="error-msg" style={{ margin: "8px 0 0" }}>{errorPoints}</div>}
        </div>

        {/* ── Start point selector ── */}
        <div className="sidebar__section">
          <div className="section__label">Punkt startowy</div>
          <div className="start-mode-toggle">
            <button
              className={`start-mode-btn${startMode === "gps" ? " active" : ""}`}
              onClick={() => handleStartModeChange("gps")}
            >
              📍 Moja lokalizacja
            </button>
            <button
              className={`start-mode-btn${startMode === "map" ? " active" : ""}`}
              onClick={() => handleStartModeChange("map")}
            >
              🗺️ Wskaż na mapie
            </button>
          </div>

          {startMode === "gps" && (
            <div style={{ marginTop: 8 }}>
              {!position && !geoLoading && (
                <button className="btn btn--ghost btn--full" onClick={getPosition}>
                  Pobierz lokalizację GPS
                </button>
              )}
              {geoLoading && <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "6px 0" }}>⏳ Pobieranie GPS…</div>}
              {position && (
                <div className="start-coord-display">
                  <span className="mono">{position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</span>
                  <button className="btn-refresh" onClick={getPosition} title="Odśwież lokalizację">↺</button>
                </div>
              )}
              {geoError && <div className="error-msg" style={{ marginTop: 6 }}>{geoError}</div>}
            </div>
          )}

          {startMode === "map" && (
            <div style={{ marginTop: 8 }}>
              {!pickingStart && !manualStart && (
                <button className="btn btn--ghost btn--full" onClick={handleActivatePick}>
                  Kliknij, aby wybrać punkt na mapie
                </button>
              )}
              {pickingStart && (
                <div className="pick-hint">
                  <span>👆 Kliknij dowolne miejsce na mapie</span>
                  <button className="btn-cancel" onClick={() => setPickingStart(false)}>Anuluj</button>
                </div>
              )}
              {manualStart && !pickingStart && (
                <div className="start-coord-display">
                  <span className="mono">{manualStart.latitude.toFixed(5)}, {manualStart.longitude.toFixed(5)}</span>
                  <button className="btn-refresh" onClick={handleActivatePick} title="Zmień punkt">✎</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading spinner */}
        {loadingPoints && (
          <div className="loader">
            <div className="spinner" />
            <span style={{ fontSize: 12 }}>Pobieranie paczkomatów…</span>
          </div>
        )}

        {/* Points list or route panel */}
        {!showRoute ? (
          <PointsList
            points={points}
            selected={selected}
            onToggle={togglePoint}
            onSelectAll={selectAll}
            onClearAll={clearAll}
          />
        ) : (
          <RoutePanel
            route={route}
            onRecalculate={handleRecalculate}
            recalcLoading={recalcLoading}
          />
        )}

        {/* Bottom action */}
        {!showRoute && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            {errorRoute && <div className="error-msg" style={{ marginBottom: 8 }}>{errorRoute}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              {route && (
                <button className="btn btn--ghost" style={{ flex: "0 0 auto" }} onClick={() => { setRoute(null); setStart(null); }}>
                  ← Lista
                </button>
              )}
              <button
                className="btn btn--primary btn--full"
                onClick={handleCalculate}
                disabled={selected.size < 2 || loadingRoute}
              >
                {loadingRoute ? "⏳ Obliczam…" : `Oblicz trasę (${selected.size})`}
              </button>
            </div>
            {selected.size < 2 && points.length > 0 && (
              <p style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                Zaznacz minimum 2 paczkomaty
              </p>
            )}
            {selected.size >= 2 && !startReady && (
              <p style={{ marginTop: 8, fontSize: 11, color: "var(--yellow)", textAlign: "center" }}>
                {startMode === "gps" ? "⚠️ Pobierz lokalizację GPS" : "⚠️ Wskaż punkt startowy na mapie"}
              </p>
            )}
          </div>
        )}

        {showRoute && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
            <button className="btn btn--ghost btn--full" style={{ fontSize: 12 }} onClick={() => { setRoute(null); setStart(null); }}>
              ← Wróć do wyboru
            </button>
          </div>
        )}
      </aside>

      {/* ── Map ────────────────────────────────────────────────── */}
      <MapView
        points={showRoute ? route.ordered : selectedPoints}
        route={route}
        start={start || effectiveStart}
        visitedIds={visitedIds}
        pickingStart={pickingStart}
        onMapPick={handleMapPick}
      />
    </div>
  );
}
