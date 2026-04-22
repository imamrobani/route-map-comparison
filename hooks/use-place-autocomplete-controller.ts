import { useCallback, useEffect, useRef, useState } from "react";

import { env } from "@/config/env";
import { isAbortError, toErrorMessage } from "@/services/errors";
import {
  searchPlaces,
  type MapboxPlaceSuggestion,
} from "@/services/mapbox.service";

export type UsePlaceAutocompleteControllerState = {
  suggestions: MapboxPlaceSuggestion[];
  isLoading: boolean;
  error: string | null;
  search: (args: {
    query: string;
    proximity?: { latitude: number; longitude: number };
    enabled?: boolean;
    minLength?: number;
    debounceMs?: number;
  }) => void;
  reset: () => void;
};

export const usePlaceAutocompleteController = (): UsePlaceAutocompleteControllerState => {
  const accessToken = env.mapboxAccessToken;

  const [suggestions, setSuggestions] = useState<MapboxPlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setSuggestions([]);
    setIsLoading(false);
    setError(null);
  }, []);

  const search = useCallback(
    (args: {
      query: string;
      proximity?: { latitude: number; longitude: number };
      enabled?: boolean;
      minLength?: number;
      debounceMs?: number;
    }) => {
      const enabled = args.enabled ?? true;
      const minLength = args.minLength ?? 3;
      const debounceMs = args.debounceMs ?? 450;
      const trimmedQuery = args.query.trim();

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

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

      if (trimmedQuery.length < minLength) {
        setSuggestions([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      debounceTimerRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setError(null);

        void (async () => {
          try {
            const results = await searchPlaces({
              query: trimmedQuery,
              accessToken,
              proximity: args.proximity,
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (requestIdRef.current !== requestId) return;
            setSuggestions(results);
          } catch (error) {
            if (controller.signal.aborted || isAbortError(error)) return;
            if (requestIdRef.current !== requestId) return;
            setSuggestions([]);
            setError(toErrorMessage(error, "Failed to search places."));
          } finally {
            if (controller.signal.aborted) return;
            if (requestIdRef.current !== requestId) return;
            setIsLoading(false);
          }
        })();
      }, debounceMs);
    },
    [accessToken],
  );

  useEffect(() => reset, [reset]);

  return {
    suggestions,
    isLoading,
    error,
    search,
    reset,
  };
};

