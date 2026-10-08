/** Reports configuration presence only — never values. */
export type IntegrationKey = "SHOPIFY" | "BLUEDART" | "DELHIVERY" | "AMAZON_SHIPPING" | "KWIKSHIP";
export type ConfigState = "NOT_CONFIGURED" | "CONFIGURED_CONTRACT_UNVERIFIED" | "READY_READ" | "READY_WRITE";
export interface IntegrationStatus {
  key: IntegrationKey; label: string; state: ConfigState;
  readSwitch: boolean; writeSwitch: boolean; contractVerified: boolean; missing: string[]; note: string;
}

const SPEC: Record<IntegrationKey, { label: string; vars: string[]; note: string }> = {
  SHOPIFY: { label: "Shopify Admin (read sync)", vars: ["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_ADMIN_ACCESS_TOKEN", "SHOPIFY_APP_SECRET"], note: "Read sync and fulfillment writeback are separate switches." },
  BLUEDART: { label: "Blue Dart", vars: ["BLUEDART_ACCOUNT_CONFIG_SECRET_REF"], note: "Surface, Air and COD entitlements are separate. Booking/label/tracking contracts not yet obtained." },
  DELHIVERY: { label: "Delhivery", vars: ["DELHIVERY_ACCOUNT_CONFIG_SECRET_REF"], note: "B2C contract not yet verified." },
  AMAZON_SHIPPING: { label: "ATS / Amazon Shipping", vars: ["AMAZON_SHIPPING_ACCOUNT_CONFIG_SECRET_REF"], note: "India onboarding/auth not yet verified." },
  KWIKSHIP: { label: "Kwik Ship (optional)", vars: ["KWIKSHIP_ACCOUNT_CONFIG_SECRET_REF"], note: "Optional; scope and pilot limits unresolved. Disabled." },
};

/** contractVerified comes from the integration-contracts ledger, not from env presence. */
export function integrationStatus(env: Record<string, string | undefined>, verified: Partial<Record<IntegrationKey, boolean>> = {}): IntegrationStatus[] {
  return (Object.keys(SPEC) as IntegrationKey[]).map(key => {
    const { label, vars, note } = SPEC[key];
    const missing = vars.filter(v => !env[v]);
    const readSwitch = env[`${key}_LIVE_READ`] === "true";
    const writeSwitch = env[`${key}_LIVE_WRITE`] === "true";
    const contractVerified = verified[key] === true;
    const state: ConfigState = missing.length ? "NOT_CONFIGURED" : !contractVerified ? "CONFIGURED_CONTRACT_UNVERIFIED" : writeSwitch && readSwitch ? "READY_WRITE" : readSwitch ? "READY_READ" : "CONFIGURED_CONTRACT_UNVERIFIED";
    return { key, label, state, readSwitch, writeSwitch, contractVerified, missing, note };
  });
}
