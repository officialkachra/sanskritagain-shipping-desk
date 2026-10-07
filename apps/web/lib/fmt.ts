export const inr = (paise: number | null | undefined) => paise == null ? "unknown" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
export const ist = (iso: string | Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const svcLabel: Record<string, string> = {
  "bluedart.surface.prepaid": "Blue Dart Surface", "bluedart.surface.cod": "Blue Dart Surface COD", "bluedart.air.prepaid": "Blue Dart Air",
  "amazon.ats.standard": "ATS / Amazon", "delhivery.surface.standard": "Delhivery",
};
export const statusText: Record<string, string> = { RECOMMENDED: "Ready to approve", REVIEW_REQUIRED: "Needs review", NO_ELIGIBLE: "No courier" };
