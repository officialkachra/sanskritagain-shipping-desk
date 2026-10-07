// Canonical domain types. Money in paise (integer). Weights in grams. Dimensions in cm.
export type Carrier = "BLUEDART" | "DELHIVERY" | "AMAZON_SHIPPING" | "KWIKSHIP";
export type PaymentMode = "PREPAID" | "COD";
export type Direction = "FORWARD" | "REVERSE";
export type ShippingIntent = "STANDARD" | "EXPRESS" | "UNKNOWN";
export type IntegrationMode = "DEMO" | "SANDBOX" | "LIVE_READ" | "LIVE_WRITE";

export interface Dims { lengthCm: number; breadthCm: number; heightCm: number }

/** A bookable service on a specific courier account. Blue Dart Surface / Air / COD are separate configs. */
export interface ServiceDef {
  id: string;
  carrier: Carrier;
  accountId: string;
  label: string;
  transport: "SURFACE" | "AIR" | "UNKNOWN";
  payments: PaymentMode[];          // only what is VERIFIED for this account+service
  directions: Direction[];
  maxWeightG: number | null;        // null = not yet known from contract
  volumetricDivisor: number | null; // from verified rate contract; null = unknown
  slabG: number | null;             // billable rounding slab from contract; null = unknown
  enabled: boolean;
  legacyClickpostLabel?: string;    // migration label only, never a direct API code
}

export type Tri = true | false | "UNKNOWN";
export interface ServiceabilityResult { serviceable: Tri; oda: Tri; source: string; version: string }

export interface Quote {
  serviceId: string;
  amountPaise: number | null;   // null = no quote. NEVER treated as zero.
  currency: "INR";
  expiresAt: Date;
  source: string;
}

export interface BlacklistEntry {
  id: string; version: number; reason: string;
  scope: { serviceId?: string; carrier?: Carrier; pincode?: string };
  expiresAt: Date | null;
}

export interface AllocationInput {
  orderRef: string;
  payment: PaymentMode;
  direction: Direction;
  intent: ShippingIntent;
  rawShippingMethod: string | null;
  destPincode: string;
  codAmountPaise: number;
  packedWeightG: number | null;
  box: Dims | null;
  packingValidated: boolean; // false when unknown SKU / unmapped variant / unvalidated bundle
}
