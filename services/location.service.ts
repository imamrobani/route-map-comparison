import * as Location from 'expo-location';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

export const requestForegroundLocationPermission = async (): Promise<LocationPermissionStatus> => {
  const response = await Location.requestForegroundPermissionsAsync();
  return response.status;
};

export const getCurrentLocation = async (): Promise<CurrentLocation> => {
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
  };
};

