function detectPreferredLanguage(
  phone,
  country
) {
  if (country) {
    const c = country.toLowerCase();
    if (c === "indonesia" || c === "id") return "id";
    if (c === "china" || c === "zh") return "zh";
    if (c === "japan" || c === "jp") return "ja";
  }

  if (phone) {
    const cleaned = phone.replace(/\D/g, "");
    console.log("cleaned: ", cleaned);
    console.log("startsWith0? ", phone.startsWith("0"));
    if (cleaned.startsWith("62") || phone.startsWith("0")) return "id";
    if (cleaned.startsWith("86")) return "zh";
    if (cleaned.startsWith("81")) return "ja";
  }

  return "en";
}

console.log(detectPreferredLanguage("081219148751", "Indonesia"));
