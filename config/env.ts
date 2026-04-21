const readEnvString = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

export const env = {
  mapboxAccessToken: readEnvString(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN),
  mapboxDownloadsToken: readEnvString(process.env.MAPBOX_DOWNLOADS_TOKEN),
} as const;

