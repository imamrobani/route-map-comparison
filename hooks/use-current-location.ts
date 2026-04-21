import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentLocation,
  requestForegroundLocationPermission,
  type CurrentLocation,
  type LocationPermissionStatus,
} from '@/services/location.service';

export type UseCurrentLocationState = {
  permissionStatus: LocationPermissionStatus | null;
  location: CurrentLocation | null;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
  refreshLocation: () => Promise<void>;
};

export const useCurrentLocation = (): UseCurrentLocationState => {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextLocation = await getCurrentLocation();
      setLocation(nextLocation);
    } catch {
      setError('Failed to get current location.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await requestForegroundLocationPermission();
      setPermissionStatus(status);
      if (status === 'granted') {
        await refreshLocation();
      } else {
        setIsLoading(false);
      }
    } catch {
      setError('Failed to request location permission.');
      setIsLoading(false);
    }
  }, [refreshLocation]);

  useEffect(() => {
    void requestPermission();
  }, [requestPermission]);

  return {
    permissionStatus,
    location,
    isLoading,
    error,
    requestPermission,
    refreshLocation,
  };
};

