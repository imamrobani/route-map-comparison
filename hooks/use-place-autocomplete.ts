import { useEffect, useMemo, useState } from "react";

import { env } from "@/config/env";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isAbortError, toErrorMessage } from "@/services/errors";
import {
  searchPlaces,
  type MapboxPlaceSuggestion,
} from "@/services/mapbox.service";

export type UsePlaceAutocompleteState = {
  suggestions: MapboxPlaceSuggestion[];
  isLoading: boolean;
  error: string | null;
};

export type UsePlaceAutocompleteOptions = {
  proximity?: {
    latitude: number;
    longitude: number;
  };
  minLength?: number;
  debounceMs?: number;
  enabled?: boolean;
};

export const usePlaceAutocomplete = (
  query: string,
  options: UsePlaceAutocompleteOptions = {},
): UsePlaceAutocompleteState => {
  const accessToken = env.mapboxAccessToken;
  const minLength = options.minLength ?? 3;
  const debounceMs = options.debounceMs ?? 400;
  const enabled = options.enabled ?? true;

  const proximityLatitude = options.proximity?.latitude;
  const proximityLongitude = options.proximity?.longitude;

  const debouncedQuery = useDebouncedValue(query.trim(), debounceMs);
  const canSearch = useMemo(
    () => Boolean(enabled && accessToken && debouncedQuery.length >= minLength),
    [accessToken, debouncedQuery.length, enabled, minLength],
  );

  const [suggestions, setSuggestions] = useState<MapboxPlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!accessToken) {
      setSuggestions([]);
      setIsLoading(false);
      setError("Missing Mapbox access token.");
      return;
    }

    if (debouncedQuery.length < minLength) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const results = await searchPlaces({
          query: debouncedQuery,
          accessToken,
          proximity:
            typeof proximityLatitude === "number" &&
            typeof proximityLongitude === "number"
              ? { latitude: proximityLatitude, longitude: proximityLongitude }
              : undefined,
          signal: controller.signal,
        });
        if (!isActive) return;
        setSuggestions(results);
      } catch (error) {
        if (!isActive) return;
        if (controller.signal.aborted || isAbortError(error)) return;
        setSuggestions([]);
        setError(toErrorMessage(error, "Failed to search places."));
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    accessToken,
    debouncedQuery,
    enabled,
    minLength,
    proximityLatitude,
    proximityLongitude,
  ]);

  if (!canSearch) {
    return {
      suggestions: [],
      isLoading: false,
      error: enabled && !accessToken ? "Missing Mapbox access token." : null,
    };
  }

  return { suggestions, isLoading, error };
};
