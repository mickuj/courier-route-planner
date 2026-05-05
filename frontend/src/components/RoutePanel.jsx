import { useState } from "react";

function fmtDuration(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function fmtDist(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function fmtLeg(leg) {
  if (!leg) return null;
  return `${fmtDuration(leg.duration)} · ${fmtDist(leg.distance)}`;
}

export default function RoutePanel({ route, onRecalculate, recalcLoading }) {
  const [visited, setVisited] = useState(new Set());

  const toggle = (id) =>
    setVisited((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const remaining = route.ordered.filter((p) => !visited.has(p.id));

  return (
    <>
      {/* Stats */}
      <div className="route-section">
        <div className="route-stats">
          <div className="stat-box">
            <div className="stat-box__label">Czas całkowity</div>
            <div className="stat-box__value">
              {fmtDuration(route.duration)}
            </div>
          </div>
          <div className="stat-box">
            <div className="stat-box__label">Dystans</div>
            <div className="stat-box__value">
              {fmtDist(route.distance)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn--primary btn--full"
            onClick={() => onRecalculate(remaining)}
            disabled={recalcLoading || remaining.length === 0}
            style={{ flex: 1 }}
          >
            {recalcLoading ? "⏳ Liczę…" : "🔄 Przelicz od teraz"}
          </button>
        </div>

        {remaining.length < route.ordered.length && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
            {route.ordered.length - remaining.length} odwiedzonych ·{" "}
            {remaining.length} pozostałych
          </div>
        )}
      </div>

      {/* Stop list */}
      <div className="section__label" style={{ padding: "10px 16px 0" }}>
        Kolejność
      </div>
      <div className="route-stops">
        {route.ordered.map((p, i) => {
          const isVisited = visited.has(p.id);
          const isNext = !isVisited && [...visited].every((vid) => {
            const idx = route.ordered.findIndex((x) => x.id === vid);
            return idx < i || idx === i;
          }) && i === route.ordered.findIndex((x) => !visited.has(x.id));

          return (
            <div
              key={p.id}
              className={`route-stop${isVisited ? " visited" : ""}${isNext ? " next" : ""}`}
            >
              <span className={`stop-number${isVisited ? " visited-num" : ""}`}>
                {isVisited ? "✓" : i + 1}
              </span>
              <div className="stop-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="stop-info__name">{p.name}</div>
                <div className="stop-info__addr">{p.address}</div>
                {route.legs?.[i] && (
                  <div className="stop-info__leg">
                    {fmtLeg(route.legs[i])}
                  </div>
                )}
              </div>
              <div className="stop-actions">
                <button
                  className={`btn-visit${isVisited ? " done" : ""}`}
                  onClick={() => toggle(p.id)}
                  disabled={isVisited}
                  title={isVisited ? "Odwiedzony" : "Oznacz jako odwiedzony"}
                >
                  {isVisited ? "✓" : "Zrób"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
