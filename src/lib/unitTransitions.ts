import type { UnitStatus } from "@/types/api";

/**
 * UX-only mirror of the backend unit-status transition rules
 * (`reos-backend/src/units/unit.constants.ts`). Used solely to hide options the
 * current user can't act on — the backend `PATCH /units/:id/status` remains the
 * real authorization/validation. Never treat this copy as security.
 *
 * Keep in sync with the backend constants if they change.
 */

/** Allowed manual transitions. Empty array = terminal state. */
export const ALLOWED_UNIT_TRANSITIONS: Record<UnitStatus, UnitStatus[]> = {
  available: ["blocked", "on_hold"],
  on_hold: ["available", "blocked"],
  blocked: ["available", "booked", "cancelled"],
  booked: ["agreement_signed", "cancelled"],
  agreement_signed: ["registered"],
  registered: ["handed_over"],
  handed_over: [],
  cancelled: [],
};

/** Roles permitted to move a unit *into* the given target status. */
export const UNIT_TRANSITION_ROLES: Record<UnitStatus, string[]> = {
  available: ["sales_manager", "builder_admin"],
  on_hold: ["sales_manager", "builder_admin"],
  blocked: ["sales_agent", "sales_manager", "builder_admin"],
  booked: ["sales_manager", "builder_admin"],
  agreement_signed: ["sales_manager", "builder_admin"],
  registered: ["sales_manager", "builder_admin"],
  handed_over: ["builder_admin"],
  cancelled: ["sales_manager", "builder_admin"],
};

/** Target statuses whose transition requires a non-empty note. */
export const UNIT_TRANSITIONS_REQUIRE_NOTE: UnitStatus[] = [
  "cancelled",
  "on_hold",
];

/**
 * Transitions available to a given role from the current status: the allowed
 * targets filtered by whether the role may reach each target.
 */
export function availableTransitions(
  current: UnitStatus | string | undefined,
  role: string | null | undefined,
): UnitStatus[] {
  if (!current) return [];
  const targets = ALLOWED_UNIT_TRANSITIONS[current as UnitStatus] ?? [];
  // The demo "admin" role maps to builder_admin (matches AppShell).
  const effectiveRole = role === "admin" ? "builder_admin" : role;
  if (!effectiveRole) return [];
  return targets.filter((t) =>
    UNIT_TRANSITION_ROLES[t].includes(effectiveRole),
  );
}

export function requiresNote(target: UnitStatus | string): boolean {
  return UNIT_TRANSITIONS_REQUIRE_NOTE.includes(target as UnitStatus);
}
