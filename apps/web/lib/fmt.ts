export const inr = (paise: number | null | undefined) => paise == null ? "unknown" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
export const ist = (iso: string | Date | null | undefined) => iso == null ? "—" : new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export const svcLabel: Record<string, string> = {
  "bluedart.surface.prepaid": "Blue Dart Surface", "bluedart.surface.cod": "Blue Dart Surface COD", "bluedart.air.prepaid": "Blue Dart Air",
  "amazon.ats.standard": "ATS / Amazon", "delhivery.surface.standard": "Delhivery",
};
export const carrierLabel: Record<string, string> = { BLUEDART: "Blue Dart", DELHIVERY: "Delhivery", AMAZON_SHIPPING: "ATS / Amazon", KWIKSHIP: "Kwik Ship" };
export const recText: Record<string, [string, string]> = {
  RECOMMENDED: ["Ready to approve", "blue"], REVIEW_REQUIRED: ["Needs review", "amber"], NEEDS_POLICY_REVIEW: ["Needs policy decision", "red"], NO_ELIGIBLE: ["No eligible courier", "red"],
};
export const trackText: Record<string, [string, string]> = {
  BOOKED: ["Booked", "grey"], PICKED_UP: ["Picked up", "blue"], IN_TRANSIT: ["In transit", "blue"], OUT_FOR_DELIVERY: ["Out for delivery", "blue"], DELIVERED: ["Delivered", "green"],
  NDR: ["Undelivered (NDR)", "amber"], RTO_INITIATED: ["RTO initiated", "red"], RTO_IN_TRANSIT: ["RTO in transit", "red"], RTO_DELIVERED: ["RTO complete", "red"], CANCELLED: ["Cancelled", "grey"], LOST: ["Lost", "red"], UNMAPPED: ["Unmapped status", "amber"],
};
