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

// --- Projects -------------------------------------------------------------

export const ProjectTypeSchema = z.enum(["apartment", "villa", "plotted"]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: ProjectTypeSchema,
    city: z.string().optional(),
    launchDate: z.string().nullable().optional(),
    possessionDate: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    createdAt: z.string().optional(),
    tenantId: z.string().optional(),
  })
  .passthrough();
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectsResponseSchema = paginatedSchema(ProjectSchema);
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;

// --- Towers ---------------------------------------------------------------

export const TowerSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    projectId: z.string(),
    name: z.string(),
    totalFloors: z.number().int().nonnegative().optional(),
    facing: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type Tower = z.infer<typeof TowerSchema>;

/**
 * Canonical shape returned by `GET /projects/:id/towers` — same paginated
 * envelope every other list endpoint uses. No union (per backend review B1).
 */
export const TowersResponseSchema = z.object({
  data: z.array(TowerSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().nonnegative().optional(),
});
export type TowersResponse = z.infer<typeof TowersResponseSchema>;

// --- Units ----------------------------------------------------------------

export const UnitStatusSchema = z.enum([
  "available",
  "blocked",
  "booked",
  "sold",
  "held",
]);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

/**
 * Widened from feat-0001 (which only read `total` from the paginated envelope).
 * All new fields optional + passthrough so feat-0001's consumers are
 * backward-compatible.
 */
export const UnitSchema = z
  .object({
    id: z.string(),
    unitNumber: z.string().optional(),
    floor: z.number().int().optional(),
    bedrooms: z.number().int().optional(),
    area: z.number().optional(),
    facing: z.string().nullable().optional(),
    isCorner: z.boolean().optional(),
    towerId: z.string().nullable().optional(),
    projectId: z.string().optional(),
    status: z.string().optional(),
    effectivePrice: z.number().nullable().optional(),
  })
  .passthrough();
export type Unit = z.infer<typeof UnitSchema>;

export const UnitsResponseSchema = paginatedSchema(UnitSchema);
export type UnitsResponse = z.infer<typeof UnitsResponseSchema>;

// --- Unit price config ----------------------------------------------------

export const UnitPriceConfigSchema = z
  .object({
    id: z.string().optional(),
    unitId: z.string(),
    basePrice: z.number(),
    floorPremium: z.number(),
    facingPremium: z.number(),
    cornerPremium: z.number(),
    discount: z.number(),
    effectivePrice: z.number(),
  })
  .passthrough();
export type UnitPriceConfig = z.infer<typeof UnitPriceConfigSchema>;

// --- Booking create -------------------------------------------------------

export const CreateBookingRequestSchema = z.object({
  leadId: z.string().min(1),
  unitId: z.string().min(1),
  bookingAmount: z.number().nonnegative().optional(),
});
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

/**
 * Strict shape for the `POST /bookings` success response. NOT `.passthrough()`
 * so the 502 guard at the BFF is reachable when the backend drops `id` or
 * `unitId` (per backend review N4).
 */
export const BookingCreatedSchema = z.object({
  id: z.string(),
  bookingNumber: z.string().optional(),
  status: z.string().optional(),
  unitId: z.string(),
  leadId: z.string().optional(),
});
export type BookingCreated = z.infer<typeof BookingCreatedSchema>;

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

// --- Payment Management (feat-0003) ---------------------------------------

export const PaymentModeSchema = z.enum([
  "cheque",
  "NEFT",
  "RTGS",
  "cash",
  "UPI",
]);
export type PaymentMode = z.infer<typeof PaymentModeSchema>;

export const MilestoneStatusSchema = z.enum(["paid", "overdue", "pending"]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const PaymentScheduleSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    bookingId: z.string(),
    totalAmount: z.number(),
    amountPaid: z.number(),
    outstanding: z.number().optional(),
  })
  .passthrough();
export type PaymentSchedule = z.infer<typeof PaymentScheduleSchema>;

export const MilestoneSchema = z
  .object({
    id: z.string(),
    scheduleId: z.string().optional(),
    name: z.string(),
    dueDate: z.string(),
    dueAmount: z.number(),
    amountPaid: z.number(),
    status: MilestoneStatusSchema.optional(),
    overdue: z.boolean().optional(),
  })
  .passthrough();
export type Milestone = z.infer<typeof MilestoneSchema>;

export const PaymentSchema = z
  .object({
    id: z.string(),
    bookingId: z.string().optional(),
    milestoneId: z.string().optional(),
    amount: z.number(),
    mode: PaymentModeSchema,
    referenceNumber: z.string().nullable().optional(),
    receiptNumber: z.string().optional(),
    status: z.enum(["cleared", "bounced"]).optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type Payment = z.infer<typeof PaymentSchema>;

export const RecordPaymentRequestSchema = z.object({
  milestoneId: z.string().min(1, "Select a milestone"),
  amount: z.number().positive("Enter an amount greater than ₹0"),
  mode: PaymentModeSchema,
  referenceNumber: z.string().optional(),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
});
export type RecordPaymentRequest = z.infer<typeof RecordPaymentRequestSchema>;

export const RecordPaymentResponseSchema = z
  .object({
    id: z.string(),
    receiptNumber: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();
export type RecordPaymentResponse = z.infer<typeof RecordPaymentResponseSchema>;

export const PaymentSchedulesResponseSchema = paginatedSchema(PaymentScheduleSchema);
export type PaymentSchedulesResponse = z.infer<typeof PaymentSchedulesResponseSchema>;

export const MilestonesResponseSchema = paginatedSchema(MilestoneSchema);
export type MilestonesResponse = z.infer<typeof MilestonesResponseSchema>;

export const PaymentsResponseSchema = paginatedSchema(PaymentSchema);
export type PaymentsResponse = z.infer<typeof PaymentsResponseSchema>;
