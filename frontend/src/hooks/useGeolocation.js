import { useState, useCallback } from "react";

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolokalizacja nie jest obsługiwana przez tę przeglądarkę.");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(`Błąd geolokalizacji: ${err.message}`);
        setLoading(false);
      },
      { timeout: 10_000, enableHighAccuracy: true }
    );
  }, []);

  return { position, loading, error, getPosition };
}
