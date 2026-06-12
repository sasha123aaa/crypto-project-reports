const COMPACT_UNITS = [
  { value: 1e3, suffix: "K" },
  { value: 1e6, suffix: "M" },
  { value: 1e9, suffix: "B" },
  { value: 1e12, suffix: "T" },
];

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function trimFixed(value, maximumFractionDigits = 2) {
  return Number(value.toFixed(maximumFractionDigits)).toString();
}

export function formatCompactNumber(value, maximumFractionDigits = 2) {
  if (!isFiniteNumber(value)) return "—";

  const abs = Math.abs(value);
  let unitIndex = -1;
  for (let index = 0; index < COMPACT_UNITS.length; index += 1) {
    if (abs >= COMPACT_UNITS[index].value) unitIndex = index;
  }
  if (unitIndex < 0) return trimFixed(value, maximumFractionDigits);

  let scaled = value / COMPACT_UNITS[unitIndex].value;
  const rounded = Number(scaled.toFixed(maximumFractionDigits));
  if (Math.abs(rounded) >= 1000 && unitIndex < COMPACT_UNITS.length - 1) {
    unitIndex += 1;
    scaled = value / COMPACT_UNITS[unitIndex].value;
  }

  return `${trimFixed(scaled, maximumFractionDigits)}${COMPACT_UNITS[unitIndex].suffix}`;
}

export function formatMoney(value) {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1e3) return `$${formatCompactNumber(value)}`;
  return `$${value.toFixed(2)}`;
}

export function formatPrice(value) {
  if (!isFiniteNumber(value)) return "—";

  const abs = Math.abs(value);
  if (abs === 0 || abs >= 1) return formatMoney(value);

  const fractionDigits = Math.min(12, Math.max(4, Math.ceil(-Math.log10(abs)) + 2));
  return `$${trimFixed(value, fractionDigits)}`;
}

export function formatPercent(value) {
  if (!isFiniteNumber(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatMultiple(value) {
  if (!isFiniteNumber(value)) return "—";
  return `${value.toFixed(2)}x`;
}
