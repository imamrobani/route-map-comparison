import { useEffect } from "react";

import { env } from "@/config/env";
import { setError, setLoading, setRoute } from "@/features/route/routeSlice";
import type { Coordinate } from "@/features/route/types";
import { isAbortError, toErrorMessage } from "@/services/errors";
import { getDirectionsRoute } from "@/services/mapbox.service";
import { useAppDispatch } from "@/store/hooks";

export type UseDirectionsOptions = {
  enabled?: boolean;
  profile?: "driving" | "walking" | "cycling" | "driving-traffic";
};

export const useDirections = (
  origin: Coordinate | null,
  destination: Coordinate | null,
  options: UseDirectionsOptions = {},
) => {
  const dispatch = useAppDispatch();
  const accessToken = env.mapboxAccessToken;
  const enabled = options.enabled ?? true;

  const originLatitude = origin?.latitude;
  const originLongitude = origin?.longitude;
  const destinationLatitude = destination?.latitude;
  const destinationLongitude = destination?.longitude;

  useEffect(() => {
    if (!enabled) return;

    if (!accessToken) {
      dispatch(setLoading(false));
      dispatch(setRoute(null));
      dispatch(setError("Missing Mapbox access token."));
      return;
    }

    if (
      typeof originLatitude !== "number" ||
      typeof originLongitude !== "number" ||
      typeof destinationLatitude !== "number" ||
      typeof destinationLongitude !== "number"
    ) {
      dispatch(setLoading(false));
      dispatch(setRoute(null));
      dispatch(setError(null));
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    dispatch(setLoading(true));
    dispatch(setError(null));

    void (async () => {
      try {
        const route = await getDirectionsRoute({
          origin: { latitude: originLatitude, longitude: originLongitude },
          destination: {
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          },
          accessToken,
          profile: options.profile,
          signal: controller.signal,
        });

        if (!isActive) return;
        if (!route) {
          dispatch(setRoute(null));
          dispatch(setError("No route found."));
          return;
        }

        dispatch(setRoute(route));
      } catch (error) {
        if (!isActive) return;
        if (controller.signal.aborted || isAbortError(error)) return;
        dispatch(setRoute(null));
        dispatch(setError(toErrorMessage(error, "Failed to fetch route.")));
      } finally {
        if (!isActive) return;
        dispatch(setLoading(false));
      }
    })();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [
    accessToken,
    destinationLatitude,
    destinationLongitude,
    dispatch,
    enabled,
    options.profile,
    originLatitude,
    originLongitude,
  ]);
};
