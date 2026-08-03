function escapeCsvValue(value: unknown) {
  const normalized =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

  return /[",\r\n]/.test(normalized)
    ? `"${normalized.replace(/"/g, "\"\"")}"`
    : normalized;
}

// Export endpoints flatten rows into CSV so teachers can download class data
// without introducing another reporting dependency before Stage 5.
export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return lines.join("\r\n");
}
