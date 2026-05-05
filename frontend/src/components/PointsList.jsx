import { useState, useMemo } from "react";

const MAX_SELECTION = 25;

export default function PointsList({ points, selected, onToggle, onSelectAll, onClearAll }) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    if (!filter.trim()) return points;
    const q = filter.toLowerCase();
    return points.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.street?.toLowerCase().includes(q)
    );
  }, [points, filter]);

  if (!points.length) {
    return (
      <div className="points-list__empty">
        Wpisz miasto i kliknij<br /><strong>Szukaj</strong>, aby załadować paczkomaty.
      </div>
    );
  }

  return (
    <>
      {/* Filter input */}
      <div style={{ padding: "8px 16px 4px" }}>
        <input
          className="input"
          placeholder="Filtruj… (nazwa, ulica)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ fontSize: 12 }}
        />
      </div>

      {/* Selection bar */}
      <div className="selection-bar">
        <span className="selection-bar__count">
          <strong>{selected.size}</strong>/{MAX_SELECTION} wybranych
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn btn--ghost"
            style={{ padding: "3px 8px", fontSize: 11 }}
            onClick={() => onSelectAll(visible.map((p) => p.id))}
            disabled={visible.length === 0}
          >
            Wszystkie
          </button>
          <button
            className="btn btn--ghost"
            style={{ padding: "3px 8px", fontSize: 11 }}
            onClick={onClearAll}
            disabled={selected.size === 0}
          >
            Wyczyść
          </button>
        </div>
      </div>

      <div className="points-list">
        {visible.map((p) => {
          const isChecked = selected.has(p.id);
          const isDisabled = !isChecked && selected.size >= MAX_SELECTION;

          return (
            <label
              key={p.id}
              className={`point-item${isChecked ? " checked" : ""}`}
              style={{ opacity: isDisabled ? 0.45 : 1 }}
            >
              <input
                type="checkbox"
                className="point-item__checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={() => onToggle(p.id)}
              />
              <div className="point-item__info">
                <div className="point-item__name">{p.name}</div>
                <div className="point-item__addr">{p.address}</div>
              </div>
              <span className={`point-item__badge${p.is247 ? " open" : ""}`}>
                {p.is247 ? "24/7" : p.openingHours || "—"}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}
