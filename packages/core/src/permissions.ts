/** Server-side, deny-by-default permission policy. UI hiding is never the control. */
export type AppRole = "ADMIN" | "PACKER" | "SUPPORT" | "ANALYST";
export type Action =
  | "order.view" | "packing.edit" | "order.hold" | "order.release" | "recommendation.rerun"
  | "booking.approve" | "booking.book" | "label.print_existing" | "export.pii"
  | "ndr.remark" | "ndr.assign" | "ndr.carrier_action" | "manifest.prepare" | "settings.view" | "import.run";

const GRANTS: Record<AppRole, readonly Action[]> = {
  ADMIN: ["order.view", "packing.edit", "order.hold", "order.release", "recommendation.rerun", "booking.approve", "booking.book",
    "label.print_existing", "export.pii", "ndr.remark", "ndr.assign", "ndr.carrier_action", "manifest.prepare", "settings.view", "import.run"],
  PACKER: ["order.view", "packing.edit", "order.hold", "recommendation.rerun", "label.print_existing", "manifest.prepare"],
  SUPPORT: ["order.view", "ndr.remark", "ndr.assign"],
  ANALYST: ["order.view"],
};

export const can = (role: string, action: Action): boolean => (GRANTS as Record<string, readonly Action[]>)[role]?.includes(action) ?? false;

export class Forbidden extends Error { constructor(public role: string, public action: Action) { super(`Role ${role} may not ${action}`); } }
export function assertCan(role: string, action: Action): void { if (!can(role, action)) throw new Forbidden(role, action); }
