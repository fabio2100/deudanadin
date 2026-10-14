export function formatCurrency(value: number) {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString("es-AR")}`;
}

export function formatCurrencyInput(value: string) {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return "";

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decimalSeparator = lastComma > lastDot ? "," : ".";

  let integerPart = cleaned;
  let decimalPart = "";

  if (lastDot !== -1 || lastComma !== -1) {
    const separatorIndex = Math.max(lastDot, lastComma);
    if (separatorIndex >= 0) {
      const parts = cleaned.split(decimalSeparator);
      decimalPart = parts.pop() ?? "";
      integerPart = parts.join("");
    }
  }

  integerPart = integerPart.replace(/\D/g, "");
  const formattedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";

  if (decimalPart) {
    decimalPart = decimalPart.replace(/\D/g, "").slice(0, 2);
    return `${formattedInteger},${decimalPart}`;
  }

  const lastChar = raw[raw.length - 1];
  if (lastChar === "." || lastChar === ",") {
    return `${formattedInteger},`;
  }

  return formattedInteger;
}

export function parseCurrencyInput(value: string) {
  const raw = String(value ?? "").trim();
  if (raw === "") return 0;

  // Heuristic: if contains comma, treat comma as decimal separator and remove dots.
  // If only dots are present, decide if dot is decimal (one dot near the end) or thousand separator.
  if (raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const dotCount = (raw.match(/\./g) || []).length;
  if (dotCount === 0) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  // If there's a single dot and it's close to the end (<=2 decimals), treat as decimal
  const lastDot = raw.lastIndexOf(".");
  if (dotCount === 1 && raw.length - lastDot - 1 <= 2) {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  // Otherwise treat dots as thousand separators and remove them
  const numeric = Number(raw.replace(/\./g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatDate(dateValue: string | Date) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
