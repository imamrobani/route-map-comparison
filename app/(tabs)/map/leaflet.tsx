import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCurrentLocation } from "@/hooks/use-current-location";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { LeafletMapView } from "@/map/leaflet/leaflet-map-view";
import {
  searchNominatimPlaces,
  type NominatimPlaceSuggestion,
} from "@/map/leaflet/nominatim.service";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function LeafletMapScreen() {
  const insets = useSafeAreaInsets();
  const hasCenteredRef = useRef(false);
  const originInputRef = useRef<TextInput>(null);
  const destinationInputRef = useRef<TextInput>(null);
  const hasUserEditedRef = useRef({ origin: false, destination: false });

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const [activeField, setActiveField] = React.useState<
    "origin" | "destination" | null
  >(null);
  const [originText, setOriginText] = React.useState("");
  const [destinationText, setDestinationText] = React.useState("");
  const [originPlace, setOriginPlace] =
    useState<NominatimPlaceSuggestion | null>(null);
  const [destinationPlace, setDestinationPlace] =
    useState<NominatimPlaceSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<NominatimPlaceSuggestion[]>(
    [],
  );
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    error: locationError,
    isLoading: isLoadingLocation,
    location,
    permissionStatus,
    refreshLocation,
    requestPermission,
  } = useCurrentLocation();

  const [shouldCenterOnUser, setShouldCenterOnUser] = React.useState(false);
  useEffect(() => {
    if (!location) return;
    if (hasCenteredRef.current) return;

    hasCenteredRef.current = true;
    setShouldCenterOnUser(true);
    const timeout = setTimeout(() => setShouldCenterOnUser(false), 250);
    return () => clearTimeout(timeout);
  }, [location]);

  const userLocation = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;

  const canSwap = Boolean(
    originText.trim().length > 0 || destinationText.trim().length > 0,
  );

  const activeQuery =
    activeField === "origin"
      ? originText
      : activeField === "destination"
        ? destinationText
        : "";

  const resetPlaces = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSuggestions([]);
    setIsSearchingPlaces(false);
    setPlacesError(null);
  }, []);

  const debouncedQuery = useDebouncedValue(activeQuery.trim(), 450);

  useEffect(() => {
    if (!activeField) {
      resetPlaces();
      return;
    }

    if (!hasUserEditedRef.current[activeField]) {
      resetPlaces();
      return;
    }

    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      setPlacesError(null);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearchingPlaces(true);
    setPlacesError(null);

    void (async () => {
      try {
        const results = await searchNominatimPlaces({
          query: debouncedQuery,
          limit: 8,
          signal: controller.signal,
        });
        setSuggestions(results);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setPlacesError("Failed to search places.");
        setSuggestions([]);
      } finally {
        setIsSearchingPlaces(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [activeField, debouncedQuery, resetPlaces]);

  const dismissOverlay = useCallback(() => {
    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    resetPlaces();
  }, [resetPlaces]);

  const handleSwapPress = useCallback(() => {
    if (!canSwap) return;

    const nextOrigin = destinationText;
    const nextDestination = originText;

    setActiveField(null);
    originInputRef.current?.blur();
    destinationInputRef.current?.blur();
    Keyboard.dismiss();
    setOriginText(nextOrigin);
    setDestinationText(nextDestination);
    hasUserEditedRef.current.origin = false;
    hasUserEditedRef.current.destination = false;
    resetPlaces();
  }, [canSwap, destinationText, originText, resetPlaces]);

  const handleOriginFocus = useCallback(() => {
    if (activeField !== "origin") resetPlaces();
    setActiveField("origin");
  }, [activeField, resetPlaces]);

  const handleDestinationFocus = useCallback(() => {
    if (activeField !== "destination") resetPlaces();
    setActiveField("destination");
  }, [activeField, resetPlaces]);

  const handleOriginChangeText = useCallback(
    (text: string) => {
      setOriginText(text);
      hasUserEditedRef.current.origin = true;

      if (originPlace && text.trim() !== originPlace.placeName) {
        setOriginPlace(null);
      }
    },
    [originPlace],
  );

  const handleDestinationChangeText = useCallback(
    (text: string) => {
      setDestinationText(text);
      hasUserEditedRef.current.destination = true;

      if (destinationPlace && text.trim() !== destinationPlace.placeName) {
        setDestinationPlace(null);
      }
    },
    [destinationPlace],
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
    )
      return "No results.";
    return null;
  }, [
    activeQuery,
    isSearchingPlaces,
    placesError,
    shouldShowSuggestions,
    suggestions.length,
  ]);

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

  const renderSuggestionSeparator = useCallback(
    () => <View style={styles.suggestionSeparator} />,
    [],
  );

  const renderSuggestionItem = useCallback(
    ({ item }: { item: NominatimPlaceSuggestion }) => (
      <Pressable
        style={styles.suggestionItem}
        onPress={() => handleSuggestionPress(item)}
      >
        <Text style={styles.suggestionText} numberOfLines={1}>
          {item.placeName.split(",")[0]}
        </Text>
        <Text style={styles.suggestionSubtext} numberOfLines={1}>
          {item.placeName}
        </Text>
      </Pressable>
    ),
    [handleSuggestionPress],
  );

  return (
    <View style={styles.container}>
      <LeafletMapView
        key={reloadNonce}
        userLocation={userLocation}
        centerOnUserLocation={shouldCenterOnUser}
        onReady={({ version: nextVersion }) => {
          setErrorMessage(null);
        }}
        onError={({ message }) => {
          setErrorMessage(message);
        }}
      />

      <View style={styles.overlayContainer} pointerEvents="box-none">
        {activeField ? (
          <Pressable style={styles.dismissOverlay} onPress={dismissOverlay} />
        ) : null}

        <View style={[styles.safeAreaTop]} pointerEvents="box-none">
          <View
            style={[styles.searchCard, { marginTop: 8 }]}
            pointerEvents="auto"
          >
            <View style={styles.searchRow}>
              <Text style={[styles.searchLabel, styles.originLabel]}>
                Point A (Origin)
              </Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <MaterialIcons
                    name="radio-button-checked"
                    size={18}
                    color="#2563EB"
                  />
                </View>
                <TextInput
                  ref={originInputRef}
                  value={originText}
                  onChangeText={handleOriginChangeText}
                  placeholder="Search origin"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  onFocus={handleOriginFocus}
                  onBlur={() => {
                    if (activeField === "origin") setActiveField(null);
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {activeField === "origin" && originText.length > 0 ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={handleClearOrigin}
                    hitSlop={8}
                  >
                    <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {canSwap ? (
              <View style={styles.swapBetweenRow} pointerEvents="box-none">
                <Pressable
                  style={styles.swapBetweenButton}
                  onPress={handleSwapPress}
                  hitSlop={10}
                  pointerEvents="auto"
                >
                  <MaterialIcons name="swap-vert" size={18} color="#2563EB" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.searchRow}>
              <Text style={[styles.searchLabel, styles.destinationLabel]}>
                Point B (Destination)
              </Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>
                  <MaterialIcons name="place" size={18} color="#F97316" />
                </View>
                <TextInput
                  ref={destinationInputRef}
                  value={destinationText}
                  onChangeText={handleDestinationChangeText}
                  placeholder="Search destination"
                  placeholderTextColor="#9CA3AF"
                  style={styles.searchInput}
                  onFocus={handleDestinationFocus}
                  onBlur={() => {
                    if (activeField === "destination") setActiveField(null);
                  }}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {activeField === "destination" && destinationText.length > 0 ? (
                  <Pressable
                    style={styles.clearButton}
                    onPress={handleClearDestination}
                    hitSlop={8}
                  >
                    <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {shouldShowSuggestions ? (
              <View style={styles.suggestionsContainer}>
                {suggestionsHint ? (
                  <Text style={styles.suggestionsHint}>{suggestionsHint}</Text>
                ) : null}
                {suggestions.length > 0 ? (
                  <FlatList
                    keyboardShouldPersistTaps="handled"
                    data={suggestions}
                    keyExtractor={(item: NominatimPlaceSuggestion) => item.id}
                    renderItem={renderSuggestionItem}
                    ItemSeparatorComponent={renderSuggestionSeparator}
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          {errorMessage ? (
            <View style={styles.errorCard} pointerEvents="auto">
              <Text style={styles.errorTitle}>Leaflet failed to load</Text>
              <Text style={styles.errorBody} numberOfLines={3}>
                {errorMessage}
              </Text>
              <Pressable
                style={styles.errorButton}
                onPress={() => {
                  setErrorMessage(null);
                  setReloadNonce((value) => value + 1);
                }}
              >
                <Text style={styles.errorButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}

          {permissionStatus === "denied" ? (
            <View style={styles.errorCard} pointerEvents="auto">
              <Text style={styles.errorTitle}>
                Location permission is disabled
              </Text>
              <Text style={styles.errorBody}>
                Enable location to center the map on your current position.
              </Text>
              <Pressable style={styles.errorButton} onPress={requestPermission}>
                <Text style={styles.errorButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {permissionStatus === "granted" &&
          !isLoadingLocation &&
          locationError ? (
            <View style={styles.errorCard} pointerEvents="auto">
              <Text style={styles.errorTitle}>Failed to get location</Text>
              <Text style={styles.errorBody}>{locationError}</Text>
              <Pressable style={styles.errorButton} onPress={refreshLocation}>
                <Text style={styles.errorButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        style={[
          styles.floatingActionButton,
          { bottom: Math.max(12, insets.bottom + 12) },
        ]}
        onPress={() => {
          if (!location) {
            void requestPermission();
            return;
          }

          setShouldCenterOnUser(true);
          setTimeout(() => setShouldCenterOnUser(false), 250);
        }}
        hitSlop={10}
      >
        <MaterialIcons name="my-location" size={20} color="#2563EB" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b1220",
  },
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeAreaTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    gap: 10,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },
  searchRow: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  originLabel: {
    color: "#2563EB",
  },
  destinationLabel: {
    color: "#F97316",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  inputIcon: {
    width: 20,
    alignItems: "center",
  },
  searchInput: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
    paddingHorizontal: 0,
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  swapBetweenRow: {
    alignItems: "flex-end",
    paddingRight: 14,
    marginTop: -18,
    marginBottom: -18,
    zIndex: 10,
  },
  swapBetweenButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 3,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  suggestionsContainer: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  suggestionsHint: {
    color: "#6B7280",
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
    color: "#111827",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  suggestionSubtext: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  suggestionSeparator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 14,
    marginRight: 14,
  },
  errorCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  errorTitle: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  errorBody: {
    color: "#374151",
    fontSize: 12,
    opacity: 0.9,
  },
  errorButton: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  floatingActionButton: {
    position: "absolute",
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 6,
  },
});
