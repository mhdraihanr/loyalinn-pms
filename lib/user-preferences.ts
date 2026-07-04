export type UserPreferences = {
  timezone: string;
  dateFormat: string;
  theme: string;
};

export const defaultUserPreferences: UserPreferences = {
  timezone: "Asia/Jakarta",
  dateFormat: "DD/MM/YYYY",
  theme: "system",
};

export function getUserPreferencesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): UserPreferences {
  const preferences =
    typeof metadata?.preferences === "object" && metadata.preferences !== null
      ? (metadata.preferences as Partial<UserPreferences>)
      : {};

  return {
    timezone: preferences.timezone ?? defaultUserPreferences.timezone,
    dateFormat: preferences.dateFormat ?? defaultUserPreferences.dateFormat,
    theme: preferences.theme ?? defaultUserPreferences.theme,
  };
}

function getDateParts(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const partMap = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    day: partMap.day ?? "",
    month: partMap.month ?? "",
    year: partMap.year ?? "",
  };
}

export function formatUserDate(
  value: string | Date | null | undefined,
  preferences: Partial<UserPreferences> = defaultUserPreferences,
) {
  if (!value) return "-";

  const merged = { ...defaultUserPreferences, ...preferences };
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  if (merged.dateFormat === "DD/MM/YYYY") {
    const parts = getDateParts(date, merged.timezone);
    return `${parts.day}/${parts.month}/${parts.year}`;
  }

  if (merged.dateFormat === "YYYY-MM-DD") {
    const parts = getDateParts(date, merged.timezone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: merged.timezone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatUserDateTime(
  value: string | Date | null | undefined,
  preferences: Partial<UserPreferences> = defaultUserPreferences,
) {
  if (!value) return "-";

  const merged = { ...defaultUserPreferences, ...preferences };
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${formatUserDate(date, merged)} ${new Intl.DateTimeFormat("en-US", {
    timeZone: merged.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

export function formatUserTime(
  value: string | Date | null | undefined,
  preferences: Partial<UserPreferences> = defaultUserPreferences,
) {
  if (!value) return "-";

  const merged = { ...defaultUserPreferences, ...preferences };
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: merged.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
