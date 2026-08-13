type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" ? (value as UnknownRecord) : null;
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function getCanonicalWahaMessageId(value: unknown) {
  const record = asRecord(value);
  if (!record) return typeof value === "string" && value.trim() ? value.trim() : null;

  const id = asRecord(record.id);
  const data = asRecord(record._data);
  const dataId = asRecord(data?.id);

  return firstString([
    record.messageId,
    typeof record.id === "string" ? record.id : null,
    id?.id,
    id?._serialized,
    id?.serialized,
    data?.messageId,
    typeof data?.id === "string" ? data.id : null,
    data?._serialized,
    dataId?.id,
    dataId?._serialized,
    dataId?.serialized,
  ]);
}
