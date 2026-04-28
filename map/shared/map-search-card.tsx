import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useCallback } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type MapSearchField = "origin" | "destination";

export type MapSearchSuggestion = {
  id: string;
  placeName: string;
};

export function MapSearchCard<Suggestion extends MapSearchSuggestion>({
  containerStyle,
  originInputRef,
  destinationInputRef,
  activeField,
  originText,
  destinationText,
  onOriginChangeText,
  onDestinationChangeText,
  onOriginFocus,
  onDestinationFocus,
  onOriginBlur,
  onDestinationBlur,
  onClearOrigin,
  onClearDestination,
  canSwap,
  onSwap,
  showSuggestions,
  suggestions,
  suggestionsHint,
  onSuggestionPress,
}: {
  containerStyle?: StyleProp<ViewStyle>;
  originInputRef?: React.RefObject<TextInput | null>;
  destinationInputRef?: React.RefObject<TextInput | null>;
  activeField: MapSearchField | null;
  originText: string;
  destinationText: string;
  onOriginChangeText: (text: string) => void;
  onDestinationChangeText: (text: string) => void;
  onOriginFocus: () => void;
  onDestinationFocus: () => void;
  onOriginBlur: () => void;
  onDestinationBlur: () => void;
  onClearOrigin: () => void;
  onClearDestination: () => void;
  canSwap: boolean;
  onSwap: () => void;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  suggestionsHint: string | null;
  onSuggestionPress: (item: Suggestion) => void;
}) {
  const renderSuggestionSeparator = useCallback(
    () => <View style={styles.suggestionSeparator} />,
    [],
  );

  const renderSuggestionItem = useCallback(
    ({ item }: { item: Suggestion }) => (
      <Pressable
        style={styles.suggestionItem}
        onPress={() => onSuggestionPress(item)}
      >
        <Text style={styles.suggestionText} numberOfLines={1}>
          {item.placeName.split(",")[0]}
        </Text>
        <Text style={styles.suggestionSubtext} numberOfLines={1}>
          {item.placeName}
        </Text>
      </Pressable>
    ),
    [onSuggestionPress],
  );

  return (
    <View style={[styles.searchCard, containerStyle]}>
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
          {activeField === "origin" ? (
            <TextInput
              ref={originInputRef}
              value={originText}
              onChangeText={onOriginChangeText}
              placeholder="Search origin"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              onFocus={onOriginFocus}
              onBlur={onOriginBlur}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus
            />
          ) : (
            <Pressable style={styles.displayField} onPress={onOriginFocus}>
              <Text
                style={originText.length > 0 ? styles.searchInput : styles.placeholderText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {originText.length > 0 ? originText : "Search origin"}
              </Text>
            </Pressable>
          )}
          {activeField === "origin" && originText.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={onClearOrigin}
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
            onPress={onSwap}
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
          {activeField === "destination" ? (
            <TextInput
              ref={destinationInputRef}
              value={destinationText}
              onChangeText={onDestinationChangeText}
              placeholder="Search destination"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              onFocus={onDestinationFocus}
              onBlur={onDestinationBlur}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus
            />
          ) : (
            <Pressable
              style={styles.displayField}
              onPress={onDestinationFocus}
            >
              <Text
                style={
                  destinationText.length > 0
                    ? styles.searchInput
                    : styles.placeholderText
                }
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {destinationText.length > 0
                  ? destinationText
                  : "Search destination"}
              </Text>
            </Pressable>
          )}
          {activeField === "destination" && destinationText.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={onClearDestination}
              hitSlop={8}
            >
              <MaterialIcons name="cancel" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showSuggestions ? (
        <View style={styles.suggestionsContainer}>
          {suggestionsHint ? (
            <Text style={styles.suggestionsHint}>{suggestionsHint}</Text>
          ) : null}
          {suggestions.length > 0 ? (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestionItem}
              ItemSeparatorComponent={renderSuggestionSeparator}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 12,
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
    paddingVertical: 10,
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
  displayField: {
    flex: 1,
    minHeight: 18,
    justifyContent: "center",
  },
  placeholderText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
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
    maxHeight: 260,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  suggestionsHint: {
    color: "#6B7280",
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
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
});
