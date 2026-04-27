import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type LngLatBounds,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCurrentLocation } from "@/hooks/use-current-location";
import { useNominatimAutocompleteController } from "@/hooks/use-nominatim-autocomplete-controller";
import {
  reverseNominatim,
  type NominatimPlaceSuggestion,
} from "@/map/leaflet/nominatim.service";
import { getOsrmRoute, type OsrmRoute } from "@/map/leaflet/osrm.service";
import { MapSearchCard } from "@/map/shared/map-search-card";
import {
  getCurrentLocation,
  requestForegroundLocationPermission,
} from "@/services/location.service";

import { styles } from "./map.styles";

const DEFAULT_CENTER: [number, number] = [106.84513, -6.21462];
const BASEMAPS = {
  openFreeMapBright: {
    label: "OpenFreeMap",
    url: "https://tiles.openfreemap.org/styles/bright",
  },
  demoTiles: {
    label: "Demo tiles",
    url: "https://demotiles.maplibre.org/style.json",
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

function formatRouteSummary(route: OsrmRoute | null) {
  if (!route) return null;

  const durationSeconds = route.durationSeconds;
  const distanceMeters = route.distanceMeters;

  if (
    typeof durationSeconds !== "number" ||
    typeof distanceMeters !== "number" ||
    !Number.isFinite(durationSeconds) ||
    !Number.isFinite(distanceMeters)
  ) {
    return null;
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  const distanceKm = distanceMeters / 1000;

  return {
    etaText: `${minutes} min`,
    distanceText:
      distanceKm >= 10
        ? `${distanceKm.toFixed(0)} km`
        : `${distanceKm.toFixed(1)} km`,
  };
}

export default function MapLibreDemoTilesScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const originInputRef = useRef<TextInput>(null);
  const destinationInputRef = useRef<TextInput>(null);
  const hasUserEditedRef = useRef({ origin: false, destination: false });
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const [isSettingOriginFromLocation, setIsSettingOriginFromLocation] =
    React.useState(false);

  const {
    error: locationError,
    isLoading: isLoadingLocation,
    location,
    permissionStatus,
    refreshLocation,
    requestPermission,
  } = useCurrentLocation();

  const {
    error: placesError,
    isLoading: isSearchingPlaces,
    suggestions,
    search: searchPlaces,
    reset: resetPlaces,
  } = useNominatimAutocompleteController();

  const [basemapKey, setBasemapKey] =
    React.useState<BasemapKey>("openFreeMapBright");

  const [activeField, setActiveField] = React.useState<
    "origin" | "destination" | null
  >(null);
  const [originText, setOriginText] = React.useState("");
  const [destinationText, setDestinationText] = React.useState("");
  const [originPlace, setOriginPlace] =
    React.useState<NominatimPlaceSuggestion | null>(null);
  const [destinationPlace, setDestinationPlace] =
    React.useState<NominatimPlaceSuggestion | null>(null);
  const [pickField, setPickField] = React.useState<
    "origin" | "destination" | null
  >(null);

  const [route, setRoute] = React.useState<OsrmRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = React.useState(false);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  const originLngLat = originPlace
    ? ([originPlace.center.longitude, originPlace.center.latitude] as [
        number,
        number,
      ])
    : null;
  const destinationLngLat = destinationPlace
    ? ([
        destinationPlace.center.longitude,
        destinationPlace.center.latitude,
      ] as [number, number])
    : null;

  const centerCoordinate: [number, number] = destinationLngLat
    ? destinationLngLat
    : originLngLat
      ? originLngLat
      : location
        ? [location.longitude, location.latitude]
        : DEFAULT_CENTER;

  const canSwap = Boolean(
    originPlace ||
    destinationPlace ||
    originText.trim().length > 0 ||
    destinationText.trim().length > 0,
  );

  const activeQuery =
    activeField === "origin"
      ? originText
      : activeField === "destination"
        ? destinationText
        : "";

  const routeLineCoordinates = useMemo<[number, number][] | null>(() => {
    const coordinates = route?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;
    return coordinates
      .map((coord) => [coord.longitude, coord.latitude] as [number, number])
      .filter(
        ([longitude, latitude]) =>
          Number.isFinite(longitude) && Number.isFinite(latitude),
      );
  }, [route?.geometry?.coordinates]);

  const routeGeoJson = useMemo(() => {
    if (!routeLineCoordinates || routeLineCoordinates.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: routeLineCoordinates,
      },
    };
  }, [routeLineCoordinates]);

  const routeBounds = useMemo<LngLatBounds | null>(() => {
    const coordinates = routeLineCoordinates;
    if (!coordinates || coordinates.length < 2) return null;

    let minLongitude = Number.POSITIVE_INFINITY;
    let minLatitude = Number.POSITIVE_INFINITY;
    let maxLongitude = Number.NEGATIVE_INFINITY;
    let maxLatitude = Number.NEGATIVE_INFINITY;

    for (const [longitude, latitude] of coordinates) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      minLongitude = Math.min(minLongitude, longitude);
      minLatitude = Math.min(minLatitude, latitude);
      maxLongitude = Math.max(maxLongitude, longitude);
      maxLatitude = Math.max(maxLatitude, latitude);
    }

    if (
      !Number.isFinite(minLongitude) ||
      !Number.isFinite(minLatitude) ||
      !Number.isFinite(maxLongitude) ||
      !Number.isFinite(maxLatitude)
    ) {
      return null;
    }

    return [
      minLongitude,
      minLatitude,
      maxLongitude,
      maxLatitude,
    ] as LngLatBounds;
  }, [routeLineCoordinates]);

  const routeSummary = useMemo(() => formatRouteSummary(route), [route]);
  const shouldShowRouteSummary = Boolean(
    routeSummary && !isLoadingRoute && !routeError,
  );
  const recenterBottomOffset =
    Math.max(12, insets.bottom + 12) + (shouldShowRouteSummary ? 100 : 0);

  useEffect(() => {
    const origin = originPlace?.center;
    const destination = destinationPlace?.center;

    if (!origin || !destination) {
      routeAbortControllerRef.current?.abort();
      routeAbortControllerRef.current = null;
      setRoute(null);
      setIsLoadingRoute(false);
      setRouteError(null);
      return;
    }

    routeAbortControllerRef.current?.abort();
    const controller = new AbortController();
    routeAbortControllerRef.current = controller;

    setIsLoadingRoute(true);
    setRouteError(null);

    void (async () => {
      try {
        const nextRoute = await getOsrmRoute({
          origin,
          destination,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRoute(nextRoute);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setRoute(null);
        setRouteError("Failed to fetch route.");
      } finally {
        if (controller.signal.aborted) return;
        setIsLoadingRoute(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [destinationPlace, originPlace]);

  useEffect(() => {
    if (!cameraRef.current) return;
    if (!routeBounds) return;

    cameraRef.current.fitBounds(routeBounds, {
      padding: {
        top: 240,
        bottom: 160,
        left: 60,
        right: 60,
      },
      duration: 450,
      easing: "fly",
    });
  }, [routeBounds]);

  const dismissOverlay = useCallback(() => {
    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
  }, [resetPlaces]);

  const handleStartPickOnMap = useCallback(() => {
    const nextField: "origin" | "destination" = activeField
      ? activeField
      : originPlace
        ? "destination"
        : "origin";

    setPickField(nextField);
    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
  }, [activeField, originPlace, resetPlaces]);

  const handleCancelPickOnMap = useCallback(() => {
    setPickField(null);
  }, []);

  const handleConfirmPickOnMap = useCallback(() => {
    if (!pickField) return;

    void (async () => {
      const center = await mapRef.current?.getCenter();
      if (!center) return;
      const [longitude, latitude] = center;

      let placeName = "Pinned location";
      try {
        const resolvedName = await reverseNominatim({ latitude, longitude });
        if (resolvedName) placeName = resolvedName;
      } catch {
        placeName = "Pinned location";
      }

      const suggestion: NominatimPlaceSuggestion = {
        id: `pinned-${latitude}-${longitude}`,
        placeName,
        center: { latitude, longitude },
      };

      if (pickField === "origin") {
        setOriginPlace(suggestion);
        setOriginText(placeName);
        hasUserEditedRef.current.origin = false;
      } else {
        setDestinationPlace(suggestion);
        setDestinationText(placeName);
        hasUserEditedRef.current.destination = false;
      }

      setPickField(null);
    })();
  }, [pickField]);

  const handleSuggestionPress = useCallback(
    (item: NominatimPlaceSuggestion) => {
      if (activeField === "origin") {
        setOriginPlace(item);
        setOriginText(item.placeName);
        hasUserEditedRef.current.origin = false;
      }

      if (activeField === "destination") {
        setDestinationPlace(item);
        setDestinationText(item.placeName);
        hasUserEditedRef.current.destination = false;
      }

      setActiveField(null);
      originInputRef.current?.blur();
      destinationInputRef.current?.blur();
      Keyboard.dismiss();
      resetPlaces();
    },
    [activeField, resetPlaces],
  );

  const handleOriginFocus = useCallback(() => {
    if (activeField !== "origin") resetPlaces();
    setActiveField("origin");

    if (hasUserEditedRef.current.origin && originText.trim().length >= 3) {
      searchPlaces({
        query: originText,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
        limit: 8,
      });
    }
  }, [activeField, originText, resetPlaces, searchPlaces]);

  const handleDestinationFocus = useCallback(() => {
    if (activeField !== "destination") resetPlaces();
    setActiveField("destination");

    if (
      hasUserEditedRef.current.destination &&
      destinationText.trim().length >= 3
    ) {
      searchPlaces({
        query: destinationText,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
        limit: 8,
      });
    }
  }, [activeField, destinationText, resetPlaces, searchPlaces]);

  const handleOriginChangeText = useCallback(
    (text: string) => {
      setOriginText(text);
      hasUserEditedRef.current.origin = true;

      if (originPlace && text.trim() !== originPlace.placeName) {
        setOriginPlace(null);
      }

      searchPlaces({
        query: text,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
        limit: 8,
      });
    },
    [originPlace, searchPlaces],
  );

  const handleDestinationChangeText = useCallback(
    (text: string) => {
      setDestinationText(text);
      hasUserEditedRef.current.destination = true;

      if (destinationPlace && text.trim() !== destinationPlace.placeName) {
        setDestinationPlace(null);
      }

      searchPlaces({
        query: text,
        enabled: true,
        minLength: 3,
        debounceMs: 450,
        limit: 8,
      });
    },
    [destinationPlace, searchPlaces],
  );

  const handleClearOrigin = useCallback(() => {
    setOriginText("");
    hasUserEditedRef.current.origin = false;
    setOriginPlace(null);
    resetPlaces();
  }, [resetPlaces]);

  const handleClearDestination = useCallback(() => {
    setDestinationText("");
    hasUserEditedRef.current.destination = false;
    setDestinationPlace(null);
    resetPlaces();
  }, [resetPlaces]);

  const handleSwapPress = useCallback(() => {
    if (!canSwap) return;

    const nextOriginPlace = destinationPlace;
    const nextDestinationPlace = originPlace;
    const nextOriginText = destinationText;
    const nextDestinationText = originText;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();

    setOriginPlace(nextOriginPlace);
    setDestinationPlace(nextDestinationPlace);
    setOriginText(nextOriginText);
    setDestinationText(nextDestinationText);

    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;
  }, [
    canSwap,
    destinationPlace,
    destinationText,
    originPlace,
    originText,
    resetPlaces,
  ]);

  const shouldShowSuggestions = Boolean(
    activeField &&
    hasUserEditedRef.current[activeField] &&
    activeQuery.trim().length > 0,
  );

  const suggestionsHint = useMemo(() => {
    if (!shouldShowSuggestions) return null;
    if (activeQuery.trim().length < 3) return "Type at least 3 characters.";
    if (placesError) return placesError;
    if (isSearchingPlaces) return "Searching…";
    if (
      !isSearchingPlaces &&
      activeQuery.trim().length >= 3 &&
      suggestions.length === 0
    ) {
      return "No results.";
    }
    return null;
  }, [
    activeQuery,
    isSearchingPlaces,
    placesError,
    shouldShowSuggestions,
    suggestions.length,
  ]);

  const handleUseCurrentLocationPress = useCallback(() => {
    if (isSettingOriginFromLocation) return;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;

    setIsSettingOriginFromLocation(true);

    void (async () => {
      try {
        const status = await requestForegroundLocationPermission();
        if (status !== "granted") return;

        const current = await getCurrentLocation();
        const fallbackName = "Current location";

        let placeName = fallbackName;
        try {
          const resolvedName = await reverseNominatim({
            latitude: current.latitude,
            longitude: current.longitude,
          });
          if (resolvedName) placeName = resolvedName;
        } catch {
          placeName = fallbackName;
        }

        const suggestion: NominatimPlaceSuggestion = {
          id: "current-location",
          placeName,
          center: {
            latitude: current.latitude,
            longitude: current.longitude,
          },
        };

        setOriginPlace(suggestion);
        setOriginText(placeName);
      } finally {
        setIsSettingOriginFromLocation(false);
      }
    })();
  }, [isSettingOriginFromLocation, resetPlaces]);

  const handleRecenterPress = useCallback(() => {
    if (routeBounds) {
      cameraRef.current?.fitBounds(routeBounds, {
        padding: {
          top: 240,
          bottom: 160,
          left: 60,
          right: 60,
        },
        duration: 450,
        easing: "fly",
      });
      return;
    }

    if (originLngLat && destinationLngLat) {
      const west = Math.min(originLngLat[0], destinationLngLat[0]);
      const south = Math.min(originLngLat[1], destinationLngLat[1]);
      const east = Math.max(originLngLat[0], destinationLngLat[0]);
      const north = Math.max(originLngLat[1], destinationLngLat[1]);
      const bounds = [west, south, east, north] as LngLatBounds;
      cameraRef.current?.fitBounds(bounds, {
        padding: {
          top: 240,
          bottom: 160,
          left: 60,
          right: 60,
        },
        duration: 450,
        easing: "fly",
      });
      return;
    }

    const fallbackCenter: [number, number] | null = location
      ? [location.longitude, location.latitude]
      : (originLngLat ?? destinationLngLat);

    if (!fallbackCenter) return;
    cameraRef.current?.easeTo({
      center: fallbackCenter,
      zoom: 14,
      duration: 450,
      easing: "ease",
    });
  }, [destinationLngLat, location, originLngLat, routeBounds]);

  const handleToggleBasemap = useCallback(() => {
    setBasemapKey((current) =>
      current === "openFreeMapBright" ? "demoTiles" : "openFreeMapBright",
    );
  }, []);

  return (
    <View style={styles.container}>
      <Map ref={mapRef} mapStyle={BASEMAPS[basemapKey].url} style={styles.map}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: centerCoordinate,
            zoom: location || originPlace || destinationPlace ? 14 : 11,
          }}
        />

        {routeGeoJson ? (
          <GeoJSONSource id="route" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              layout={{
                "line-join": "round",
                "line-cap": "round",
              }}
              paint={{
                "line-color": "#2563EB",
                "line-width": 5,
                "line-opacity": 0.9,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {originLngLat ? (
          <Marker id="origin" lngLat={originLngLat} anchor="bottom">
            <View style={styles.markerDot}>
              <View style={styles.markerDotInner} />
            </View>
          </Marker>
        ) : null}

        {destinationLngLat ? (
          <Marker id="destination" lngLat={destinationLngLat} anchor="bottom">
            <View style={styles.markerPin}>
              <View style={styles.markerPinInner} />
            </View>
          </Marker>
        ) : null}
      </Map>

      <View style={styles.overlayContainer} pointerEvents="box-none">
        {activeField ? (
          <Pressable style={styles.dismissOverlay} onPress={dismissOverlay} />
        ) : null}

        <View style={styles.safeAreaTop} pointerEvents="box-none">
          <MapSearchCard
            containerStyle={{ marginTop: 8, marginHorizontal: 16 }}
            originInputRef={originInputRef}
            destinationInputRef={destinationInputRef}
            activeField={activeField}
            originText={originText}
            destinationText={destinationText}
            onOriginChangeText={handleOriginChangeText}
            onDestinationChangeText={handleDestinationChangeText}
            onOriginFocus={handleOriginFocus}
            onDestinationFocus={handleDestinationFocus}
            onOriginBlur={() => {
              if (activeField === "origin") {
                setActiveField(null);
                resetPlaces();
              }
            }}
            onDestinationBlur={() => {
              if (activeField === "destination") {
                setActiveField(null);
                resetPlaces();
              }
            }}
            onClearOrigin={handleClearOrigin}
            onClearDestination={handleClearDestination}
            canSwap={canSwap}
            onSwap={handleSwapPress}
            showSuggestions={shouldShowSuggestions}
            suggestions={suggestions}
            suggestionsHint={suggestionsHint}
            onSuggestionPress={handleSuggestionPress}
          />

          <View style={styles.belowCardActions} pointerEvents="box-none">
            <Pressable
              style={styles.belowCardIconButton}
              onPress={handleToggleBasemap}
              hitSlop={8}
              pointerEvents="auto"
            >
              <MaterialIcons name="layers" size={18} color="#2563EB" />
            </Pressable>
            <Pressable
              style={styles.belowCardIconButton}
              onPress={handleStartPickOnMap}
              hitSlop={8}
              pointerEvents="auto"
            >
              <MaterialIcons
                name="add-location-alt"
                size={18}
                color="#2563EB"
              />
            </Pressable>
            <Pressable
              style={styles.belowCardIconButton}
              onPress={handleUseCurrentLocationPress}
              hitSlop={8}
              pointerEvents="auto"
            >
              {isSettingOriginFromLocation ? (
                <ActivityIndicator size="small" color="#2563EB" />
              ) : (
                <MaterialIcons name="my-location" size={18} color="#2563EB" />
              )}
            </Pressable>
          </View>

          {isLoadingRoute ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Fetching route…</Text>
            </View>
          ) : null}

          {routeError && !isLoadingRoute ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>{routeError}</Text>
            </View>
          ) : null}

          {isLoadingLocation ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>Getting your location…</Text>
            </View>
          ) : null}

          {permissionStatus === "denied" ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>
                Location permission is disabled.
              </Text>
              <Text style={styles.bannerBody}>
                Enable location to center the map on your position.
              </Text>
              <View style={styles.bannerActions}>
                <Pressable style={styles.button} onPress={requestPermission}>
                  <Text style={styles.buttonText}>Try again</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {permissionStatus === "granted" &&
          !isLoadingLocation &&
          locationError ? (
            <View style={styles.banner}>
              <Text style={styles.bannerTitle}>{locationError}</Text>
              <View style={styles.bannerActions}>
                <Pressable style={styles.button} onPress={refreshLocation}>
                  <Text style={styles.buttonText}>Retry</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {routeSummary && !isLoadingRoute && !routeError ? (
          <View
            style={[
              styles.routeSummaryCard,
              { marginBottom: Math.max(12, insets.bottom + 12) },
            ]}
          >
            <View style={styles.routeSummaryRow}>
              <Text style={styles.routeSummaryLabel}>ETA</Text>
              <Text style={styles.routeSummaryValue}>
                {routeSummary.etaText}
              </Text>
            </View>
            <View style={styles.routeSummaryDivider} />
            <View style={styles.routeSummaryRow}>
              <Text style={styles.routeSummaryLabel}>Distance</Text>
              <Text style={styles.routeSummaryValue}>
                {routeSummary.distanceText}
              </Text>
            </View>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.floatingActionButton,
            { bottom: recenterBottomOffset },
          ]}
          onPress={handleRecenterPress}
          hitSlop={10}
        >
          <MaterialIcons name="center-focus-strong" size={20} color="#2563EB" />
        </Pressable>

        {pickField ? (
          <View style={styles.pickOverlay} pointerEvents="box-none">
            <View style={styles.crosshair} pointerEvents="none">
              <View style={styles.crosshairDot} />
            </View>
            <View style={styles.pickBanner} pointerEvents="none">
              <Text style={styles.bannerTitle}>
                Move the map, then tap Confirm to set {pickField}.
              </Text>
            </View>
            <View style={styles.pickActions} pointerEvents="auto">
              <Pressable
                style={styles.buttonSecondary}
                onPress={handleCancelPickOnMap}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={handleConfirmPickOnMap}>
                <Text style={styles.buttonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
