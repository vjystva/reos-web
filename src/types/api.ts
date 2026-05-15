import { z } from "zod";

/**
 * Zod schemas for all reos-backend API response shapes used by the frontend.
 * Inferred types are the single source of truth — never type response bodies by hand.
 */

// --- User -----------------------------------------------------------------

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.string(),
  tenantId: z.string(),
  name: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// --- Login ----------------------------------------------------------------

export const LoginRequestSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Upstream `/auth/login` response (captured server-side in the BFF only).
 * The BFF strips the tokens before returning to the browser.
 */
export const UpstreamLoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive().optional(),
  user: UserSchema,
});
export type UpstreamLoginResponse = z.infer<typeof UpstreamLoginResponseSchema>;

/** What the browser actually receives from `/api/auth/login`. */
export const LoginResponseSchema = z.object({
  user: UserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// --- Refresh --------------------------------------------------------------

export const UpstreamRefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive().optional(),
});
export type UpstreamRefreshResponse = z.infer<
  typeof UpstreamRefreshResponseSchema
>;

// --- Leads ----------------------------------------------------------------

export const LeadStageSchema = z.enum([
  "new",
  "contacted",
  "site_visit_scheduled",
  "site_visit_done",
  "negotiation",
  "booking",
  "lost",
]);
export type LeadStage = z.infer<typeof LeadStageSchema>;

export const LEAD_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "site_visit_scheduled",
  "site_visit_done",
  "negotiation",
  "booking",
  "lost",
];

export const LeadTemperatureSchema = z.enum(["hot", "warm", "cold"]);
export type LeadTemperature = z.infer<typeof LeadTemperatureSchema>;

export const LeadDealerSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const LeadActivitySchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  description: z.string().optional(),
  occurredAt: z.string(),
});
export type LeadActivity = z.infer<typeof LeadActivitySchema>;

export const LeadScoreBreakdownSchema = z.record(z.string(), z.number());
export type LeadScoreBreakdown = z.infer<typeof LeadScoreBreakdownSchema>;

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  stage: LeadStageSchema,
  temperature: LeadTemperatureSchema,
  aiScore: z.number().nullable().optional(),
  assignedDealer: LeadDealerSchema.nullable().optional(),
  createdAt: z.string(),
  scoreBreakdown: LeadScoreBreakdownSchema.nullable().optional(),
  activity: z.array(LeadActivitySchema).nullable().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

// --- Paginated envelope ---------------------------------------------------

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative().optional(),
    pageSize: z.number().int().nonnegative().optional(),
  });
}

export const LeadsResponseSchema = paginatedSchema(LeadSchema);
export type LeadsResponse = z.infer<typeof LeadsResponseSchema>;

// --- Bookings -------------------------------------------------------------

export const BookingSchema = z
  .object({
    id: z.string(),
    leadId: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type Booking = z.infer<typeof BookingSchema>;

export const BookingsResponseSchema = paginatedSchema(BookingSchema);
export type BookingsResponse = z.infer<typeof BookingsResponseSchema>;

// --- Units ----------------------------------------------------------------

export const UnitSchema = z
  .object({
    id: z.string(),
    status: z.string().optional(),
  })
  .passthrough();
export type Unit = z.infer<typeof UnitSchema>;

export const UnitsResponseSchema = paginatedSchema(UnitSchema);
export type UnitsResponse = z.infer<typeof UnitsResponseSchema>;

// --- Metrics --------------------------------------------------------------

export const MetricsResponseSchema = z.object({
  totalLeads: z.number().nullable(),
  hotLeads: z.number().nullable(),
  bookings: z.number().nullable(),
  units: z.object({
    available: z.number().nullable(),
    blocked: z.number().nullable(),
    booked: z.number().nullable(),
  }),
  failed: z.array(z.string()),
});
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

// --- Error envelope -------------------------------------------------------

export const ErrorEnvelopeSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
