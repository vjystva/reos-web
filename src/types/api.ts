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
  tenantId: z.string().nullable(),
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
  tenantId: z.string().optional(),
  // Backend sends firstName + lastName; older shape sent name directly
  name: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  // Backend sends pipelineStage; older shape sent stage
  stage: LeadStageSchema.optional(),
  pipelineStage: LeadStageSchema.optional(),
  // Backend sends leadTemperature; older shape sent temperature
  temperature: LeadTemperatureSchema.optional(),
  leadTemperature: LeadTemperatureSchema.optional(),
  aiScore: z.number().nullable().optional(),
  assignedDealer: LeadDealerSchema.nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  scoreBreakdown: LeadScoreBreakdownSchema.nullable().optional(),
  activity: z.array(LeadActivitySchema).nullable().optional(),
}).transform((lead) => ({
  ...lead,
  name: (lead.name ?? [lead.firstName, lead.lastName].filter(Boolean).join(" ")) || "",
  stage: (lead.stage ?? lead.pipelineStage ?? "new") as LeadStage,
  temperature: (lead.temperature ?? lead.leadTemperature ?? "cold") as LeadTemperature,
}));
export type Lead = z.infer<typeof LeadSchema>;

// Single-lead BFF wraps the raw backend shape directly (no { lead: ... } envelope)
export const LeadResponseSchema = LeadSchema;
export type LeadResponse = Lead;

export const UpdateLeadRequestSchema = z.object({
  stage: LeadStageSchema.optional(),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
  assignedTo: z.string().optional(),
});
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;

export const LEAD_SOURCES = ["web_form", "whatsapp", "phone", "csv_import", "third_party_api"] as const;
export type LeadSource = typeof LEAD_SOURCES[number];
export const LeadSourceSchema = z.enum(LEAD_SOURCES);

export const CreateLeadRequestSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(120),
  lastName: z.string().min(1, "Last name is required").max(120),
  phone: z.string().regex(/^\+?[0-9][0-9 -]{6,19}$/, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  source: LeadSourceSchema,
  budgetMin: z.number().min(0).optional(),
  budgetMax: z.number().min(0).optional(),
  preferredLocation: z.string().max(200).optional(),
  projectInterest: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
});
export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;

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

// --- Booking detail (feat-0030) -------------------------------------------

export const BookingDetailSchema = z.object({
  id: z.string(),
  bookingNumber: z.string().optional(),
  status: z.string(),
  unitId: z.string(),
  leadId: z.string().optional(),
  tenantId: z.string().optional(),
  bookingAmount: z.union([z.string(), z.number()]).nullable().optional(),
  notes: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export type BookingDetail = z.infer<typeof BookingDetailSchema>;

// --- Projects -------------------------------------------------------------

export const ProjectTypeSchema = z.enum(["apartment", "villa", "plotted"]);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    // Backend sends projectType; older shape sent type
    type: ProjectTypeSchema.optional(),
    projectType: ProjectTypeSchema.optional(),
    city: z.string().optional(),
    location: z.string().optional(),
    launchDate: z.string().nullable().optional(),
    possessionDate: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    createdAt: z.string().optional(),
    tenantId: z.string().optional(),
  })
  .passthrough()
  .transform((p) => ({
    ...p,
    type: (p.type ?? p.projectType ?? "apartment") as ProjectType,
  }));
export type Project = z.infer<typeof ProjectSchema>;

export const ProjectsResponseSchema = paginatedSchema(ProjectSchema);
export type ProjectsResponse = z.infer<typeof ProjectsResponseSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255),
  projectType: ProjectTypeSchema,
  location: z.string().min(1, "Location is required").max(500),
  city: z.string().min(1, "City is required").max(100),
  description: z.string().max(5000).optional(),
  launchDate: z.string().optional(),
  possessionDate: z.string().optional(),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

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

/**
 * Real 8-value lifecycle — source of truth is the backend's `UNIT_STATUSES`
 * (`reos-backend/src/units/unit.constants.ts`). Keep in sync with the badge
 * colours in `UnitStatusBadge.tsx` and the transition map in
 * `lib/unitTransitions.ts`.
 */
export const UNIT_STATUSES = [
  "available",
  "on_hold",
  "blocked",
  "booked",
  "agreement_signed",
  "registered",
  "handed_over",
  "cancelled",
] as const;
export const UnitStatusSchema = z.enum(UNIT_STATUSES);
export type UnitStatus = z.infer<typeof UnitStatusSchema>;

// Facing directions accepted by the backend CreateUnitDto.
export const FACING_DIRECTIONS = [
  "north",
  "south",
  "east",
  "west",
  "north_east",
  "north_west",
  "south_east",
  "south_west",
] as const;
export const FacingDirectionSchema = z.enum(FACING_DIRECTIONS);
export type FacingDirection = z.infer<typeof FacingDirectionSchema>;

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
    /** alias used by inventory page */
    areaSqft: z.number().optional(),
    facing: z.string().nullable().optional(),
    isCorner: z.boolean().optional(),
    towerId: z.string().nullable().optional(),
    projectId: z.string().optional(),
    status: z.string().optional(),
    effectivePrice: z.number().nullable().optional(),
    /** list price alias (nullable per spec) */
    listPrice: z.number().nullable().optional(),
  })
  .passthrough();
export type Unit = z.infer<typeof UnitSchema>;

export const UnitsResponseSchema = paginatedSchema(UnitSchema);
export type UnitsResponse = z.infer<typeof UnitsResponseSchema>;

/**
 * Mirrors the backend `CreateUnitDto`. `towerId` is only sent for apartment
 * projects; the BFF routes to the tower-nested vs project-flat endpoint based
 * on its presence.
 */
export const CreateUnitRequestSchema = z.object({
  // Non-empty string rather than z.string().uuid(): the backend
  // (ParseUUIDPipe / @IsUUID) is the authoritative UUID check and is more
  // lenient than zod's strict RFC-4122 regex, which would reject otherwise-
  // valid tower ids (e.g. seed data with non-standard variant bits).
  towerId: z.string().min(1).optional(),
  unitNumber: z.string().min(1, "Unit number is required").max(50),
  floor: z.number().int().min(-10).max(500),
  bedrooms: z.number().int().min(0).max(20),
  area: z.number().positive("Area must be greater than 0"),
  facing: FacingDirectionSchema.optional(),
  isCorner: z.boolean().optional(),
});
export type CreateUnitRequest = z.infer<typeof CreateUnitRequestSchema>;

/**
 * Mirrors the backend `TransitionUnitStatusDto`. `note` is required by the
 * backend for `cancelled`/`on_hold` targets (enforced server-side).
 */
export const TransitionUnitStatusRequestSchema = z.object({
  toStatus: UnitStatusSchema,
  note: z.string().min(1).max(1000).optional(),
});
export type TransitionUnitStatusRequest = z.infer<
  typeof TransitionUnitStatusRequestSchema
>;

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

export const MilestoneStatusSchema = z.enum(["pending", "due", "paid", "overdue", "waived"]);
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

// --- Site Visits (feat-0004) ---------------------------------------------

export const SiteVisitStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
]);
export type SiteVisitStatus = z.infer<typeof SiteVisitStatusSchema>;

export const SITE_VISIT_STATUSES: SiteVisitStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
];

export const SiteVisitSchema = z
  .object({
    id: z.string(),
    bookingId: z.string(),
    tenantId: z.string().optional(),
    visitDate: z.string(),
    status: SiteVisitStatusSchema,
    assignedAgentId: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type SiteVisit = z.infer<typeof SiteVisitSchema>;

export const SiteVisitHistorySchema = z
  .object({
    id: z.string(),
    siteVisitId: z.string(),
    status: SiteVisitStatusSchema,
    changedBy: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type SiteVisitHistory = z.infer<typeof SiteVisitHistorySchema>;

export const SiteVisitsResponseSchema = paginatedSchema(SiteVisitSchema);
export type SiteVisitsResponse = z.infer<typeof SiteVisitsResponseSchema>;

export const RescheduleVisitRequestSchema = z.object({
  visitDate: z.string().min(1, "Visit date is required"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
});
export type RescheduleVisitRequest = z.infer<typeof RescheduleVisitRequestSchema>;

export const CancelVisitRequestSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500, "Reason must be 500 characters or fewer"),
});
export type CancelVisitRequest = z.infer<typeof CancelVisitRequestSchema>;

// --- Tenant-wide site visits (calendar) -----------------------------------

/**
 * Raw wire shape of `GET /site-visits` on the backend (SiteVisitResponseDto):
 * lead-scoped, `scheduledAt`, nullable project/unit/agent.
 *
 * Deliberately separate from `SiteVisitSchema` above — that one models the
 * booking-scoped shape (`bookingId` + `visitDate`) the per-booking screens
 * already depend on. Keeping two schemas means neither consumer has to loosen
 * its contract, and no existing route changes behaviour.
 */
export const TenantSiteVisitSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    leadId: z.string(),
    projectId: z.string().nullable().optional(),
    unitId: z.string().nullable().optional(),
    assignedAgentId: z.string().nullable().optional(),
    scheduledAt: z.string(),
    status: SiteVisitStatusSchema,
    rescheduleCount: z.number().nullable().optional(),
    cancellationReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    confirmedBy: z.string().nullable().optional(),
    confirmedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    cancelledAt: z.string().nullable().optional(),
    createdBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type TenantSiteVisit = z.infer<typeof TenantSiteVisitSchema>;

export const TenantSiteVisitsResponseSchema = paginatedSchema(
  TenantSiteVisitSchema,
);
export type TenantSiteVisitsResponse = z.infer<
  typeof TenantSiteVisitsResponseSchema
>;

// --- Notifications (feat-0005) -------------------------------------------

export const NotificationSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    userId: z.string().optional(),
    type: z.string(),
    title: z.string(),
    body: z.string().nullable().optional(),
    link: z.string().nullable().optional(),
    isRead: z.boolean(),
    readAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationsResponseSchema = paginatedSchema(NotificationSchema);
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;

export const UnreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

// --- Analytics (feat-0005) -----------------------------------------------

export const AnalyticsOverviewSchema = z.object({
  totalLeads: z.number().nullable(),
  leadsThisMonth: z.number().nullable(),
  hotLeads: z.number().nullable(),
  totalBookings: z.number().nullable(),
  activeBookings: z.number().nullable(),
  totalRevenue: z.number().nullable(),
  collectedRevenue: z.number().nullable(),
  pendingRevenue: z.number().nullable(),
  totalUnits: z.number().nullable(),
  availableUnits: z.number().nullable(),
  bookedUnits: z.number().nullable(),
  pendingSiteVisits: z.number().nullable(),
});
export type AnalyticsOverview = z.infer<typeof AnalyticsOverviewSchema>;

export const FunnelStageSchema = z.object({
  stage: z.string(),
  count: z.number().int().nonnegative(),
});
export type FunnelStage = z.infer<typeof FunnelStageSchema>;

export const LeadsFunnelResponseSchema = z.object({
  funnel: z.array(FunnelStageSchema),
});
export type LeadsFunnelResponse = z.infer<typeof LeadsFunnelResponseSchema>;

export const RevenueTrendPointSchema = z.object({
  month: z.string(),
  amount: z.number(),
});
export type RevenueTrendPoint = z.infer<typeof RevenueTrendPointSchema>;

export const RevenueTrendResponseSchema = z.object({
  trend: z.array(RevenueTrendPointSchema),
});
export type RevenueTrendResponse = z.infer<typeof RevenueTrendResponseSchema>;

// --- Analytics deep-dive (feat-0010) -------------------------------------

export const BookingsByProjectPointSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  bookingCount: z.number(),
  totalRevenue: z.number(),
});
export type BookingsByProjectPoint = z.infer<typeof BookingsByProjectPointSchema>;

export const BookingsByProjectResponseSchema = z.object({
  data: z.array(BookingsByProjectPointSchema),
});
export type BookingsByProjectResponse = z.infer<
  typeof BookingsByProjectResponseSchema
>;

export const TopDealerPointSchema = z.object({
  dealerId: z.string(),
  dealerName: z.string(),
  leadCount: z.number(),
  conversionRate: z.number(),
});
export type TopDealerPoint = z.infer<typeof TopDealerPointSchema>;

export const TopDealersResponseSchema = z.object({
  dealers: z.array(TopDealerPointSchema),
});
export type TopDealersResponse = z.infer<typeof TopDealersResponseSchema>;

// --- Analytics deep-dive 2 (feat-0017) -----------------------------------

export const LeadsBySourceItemSchema = z.object({
  source: z.string(),
  count: z.number().int().nonnegative(),
});
export type LeadsBySourceItem = z.infer<typeof LeadsBySourceItemSchema>;

export const LeadsBySourceResponseSchema = z.object({
  data: z.array(LeadsBySourceItemSchema),
});
export type LeadsBySourceResponse = z.infer<typeof LeadsBySourceResponseSchema>;

export const BookingsByProjectItemSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  count: z.number().int().nonnegative(),
});
export type BookingsByProjectItem = z.infer<typeof BookingsByProjectItemSchema>;

export const BookingsByProjectItemResponseSchema = z.object({
  data: z.array(BookingsByProjectItemSchema),
});
export type BookingsByProjectItemResponse = z.infer<
  typeof BookingsByProjectItemResponseSchema
>;

export const PaymentsByMonthItemSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  totalAmount: z.number(),
});
export type PaymentsByMonthItem = z.infer<typeof PaymentsByMonthItemSchema>;

export const PaymentsByMonthResponseSchema = z.object({
  data: z.array(PaymentsByMonthItemSchema),
});
export type PaymentsByMonthResponse = z.infer<
  typeof PaymentsByMonthResponseSchema
>;

export const ConversionFunnelStageSchema = z.object({
  stage: z.string(),
  count: z.number().int().nonnegative(),
  conversionRate: z.number(),
});
export type ConversionFunnelStage = z.infer<typeof ConversionFunnelStageSchema>;

export const ConversionFunnelSchema = z.object({
  stages: z.array(ConversionFunnelStageSchema),
});
export type ConversionFunnel = z.infer<typeof ConversionFunnelSchema>;

// --- Tasks (feat-0006) ---------------------------------------------------

export const TaskStatusSchema = z.enum([
  "open",
  "in_progress",
  "completed",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TASK_STATUSES: TaskStatus[] = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

export const TaskResourceTypeSchema = z.enum(["lead", "booking", "site_visit"]);
export type TaskResourceType = z.infer<typeof TaskResourceTypeSchema>;

export const TaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: TaskStatusSchema,
    priority: TaskPrioritySchema,
    assignedTo: z.string().nullable().optional(),
    createdBy: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    resourceType: TaskResourceTypeSchema.nullable().optional(),
    resourceId: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type Task = z.infer<typeof TaskSchema>;

export const TasksResponseSchema = paginatedSchema(TaskSchema);
export type TasksResponse = z.infer<typeof TasksResponseSchema>;

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or fewer"),
  description: z.string().max(2000, "Description must be 2000 characters or fewer").optional(),
  priority: TaskPrioritySchema,
  assignedTo: z.string().min(1, "Assignee is required"),
  dueDate: z.string().optional(),
  resourceType: TaskResourceTypeSchema.optional(),
  resourceId: z.string().optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  assignedTo: z.string().min(1).optional(),
  dueDate: z.string().nullable().optional(),
  resourceType: TaskResourceTypeSchema.nullable().optional(),
  resourceId: z.string().nullable().optional(),
});
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

// --- Documents (feat-0007) ------------------------------------------------

export const DocumentResourceTypeSchema = z.enum([
  "booking",
  "lead",
  "project",
  "task",
]);
export type DocumentResourceType = z.infer<typeof DocumentResourceTypeSchema>;

export const DOCUMENT_RESOURCE_TYPES: DocumentResourceType[] = [
  "booking",
  "lead",
  "project",
  "task",
];

export const DocumentFileTypeSchema = z.enum([
  "pdf",
  "image",
  "spreadsheet",
  "other",
]);
export type DocumentFileType = z.infer<typeof DocumentFileTypeSchema>;

export const DOCUMENT_FILE_TYPES: DocumentFileType[] = [
  "pdf",
  "image",
  "spreadsheet",
  "other",
];

export const DocumentSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    resourceType: DocumentResourceTypeSchema,
    resourceId: z.string(),
    name: z.string(),
    url: z.string(),
    fileType: DocumentFileTypeSchema,
    fileSize: z.number().nonnegative().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentsResponseSchema = z.object({
  documents: z.array(DocumentSchema),
});
export type DocumentsResponse = z.infer<typeof DocumentsResponseSchema>;

export const CreateDocumentRequestSchema = z.object({
  resourceType: DocumentResourceTypeSchema,
  resourceId: z.string().min(1, "Resource ID is required"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer"),
  url: z
    .string()
    .min(1, "URL is required")
    .url("Enter a valid URL"),
  fileType: DocumentFileTypeSchema,
  fileSize: z.number().positive("File size must be greater than 0").optional(),
});
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;

// --- Dealers (feat-0009) -------------------------------------------------

export const DealerStatusSchema = z.enum(["active", "inactive", "suspended"]);
export type DealerStatus = z.infer<typeof DealerStatusSchema>;

export const DEALER_STATUSES: DealerStatus[] = [
  "active",
  "inactive",
  "suspended",
];

/**
 * KYC verification state — mirrors the `dealers.kyc_status` CHECK constraint
 * added by backend migration 027 (`pending` | `verified` | `rejected`, DB
 * default `pending`).
 */
export const DealerKycStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
]);
export type DealerKycStatus = z.infer<typeof DealerKycStatusSchema>;

export const DEALER_KYC_STATUSES: DealerKycStatus[] = [
  "pending",
  "verified",
  "rejected",
];

export const DealerSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    company: z.string().nullable().optional(),
    commissionRate: z.number().optional(),
    status: DealerStatusSchema,
    // RERA registration id + KYC state (backend feat: dealers.rera_id /
    // dealers.kyc_status, migration 027). Optional + nullable so dealer rows
    // written before that migration — and any mock fixtures — still parse.
    reraId: z.string().nullable().optional(),
    kycStatus: DealerKycStatusSchema.nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
export type Dealer = z.infer<typeof DealerSchema>;

export const DealersResponseSchema = z
  .object({
    // Backend sends { data: [...] }; older shape sent { dealers: [...] }
    dealers: z.array(DealerSchema).optional(),
    data: z.array(DealerSchema).optional(),
    total: z.number().optional(),
  })
  .transform((r) => ({ ...r, dealers: r.dealers ?? r.data ?? [] }));
export type DealersResponse = z.infer<typeof DealersResponseSchema>;

export const CreateDealerRequestSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z
    .string()
    .email("Enter a valid email address")
    .optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  commissionRate: z
    .number()
    .min(0, "Commission must be 0 or greater")
    .max(100, "Commission must be 100 or less")
    .optional(),
});
export type CreateDealerRequest = z.infer<typeof CreateDealerRequestSchema>;

export const UpdateDealerRequestSchema = z.object({
  name: z.string().min(1, "Name required").optional(),
  email: z.string().email("Enter a valid email address").optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  commissionRate: z
    .number()
    .min(0, "Commission must be 0 or greater")
    .max(100, "Commission must be 100 or less")
    .optional(),
  status: DealerStatusSchema.optional(),
});
export type UpdateDealerRequest = z.infer<typeof UpdateDealerRequestSchema>;

// --- Dealer Performance (feat-0020) ---------------------------------------

export const DealerPerformanceSchema = z.object({
  dealerId: z.string(),
  dealerName: z.string(),
  leadCount: z.number().int().nonnegative(),
  bookingCount: z.number().int().nonnegative(),
  conversionRate: z.number(),
  revenue: z.number(),
});
export type DealerPerformance = z.infer<typeof DealerPerformanceSchema>;

export const DealerPerformanceResponseSchema = z.object({
  performance: DealerPerformanceSchema,
});
export type DealerPerformanceResponse = z.infer<
  typeof DealerPerformanceResponseSchema
>;

export const DealersPerformanceResponseSchema = z.object({
  performance: z.array(DealerPerformanceSchema),
});
export type DealersPerformanceResponse = z.infer<
  typeof DealersPerformanceResponseSchema
>;

// --- Reports & Exports (feat-0011) ---------------------------------------

export const ReportTypeSchema = z.enum([
  "leads",
  "bookings",
  "payments",
  "site_visits",
  "leads_summary",
  "bookings_summary",
  "revenue_summary",
  "project_wise_sales",
  "sales_performance",
  "agent_commission",
  "collection_report",
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const REPORT_TYPES: ReportType[] = [
  "leads",
  "bookings",
  "payments",
  "site_visits",
  "leads_summary",
  "bookings_summary",
  "revenue_summary",
  "project_wise_sales",
  "sales_performance",
  "agent_commission",
  "collection_report",
];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  leads: "Leads",
  bookings: "Bookings",
  payments: "Payments",
  site_visits: "Site Visits",
  leads_summary: "Leads Summary",
  bookings_summary: "Bookings Summary",
  revenue_summary: "Revenue Summary",
  project_wise_sales: "Project Wise Sales",
  sales_performance: "Sales Performance",
  agent_commission: "Agent Commission",
  collection_report: "Collection Report",
};

export const ReportFormatSchema = z.enum(["csv", "json"]);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export const REPORT_FORMATS: ReportFormat[] = ["csv", "json"];

export const ReportJobStatusSchema = z.enum([
  "queued",
  "running",
  "processing",
  "completed",
  "failed",
]);
export type ReportJobStatus = z.infer<typeof ReportJobStatusSchema>;

/**
 * Body shape for `POST /api/reports` — generate a report job.
 * `dateFrom` / `dateTo` are ISO date strings (YYYY-MM-DD); when both are present
 * the refinement guarantees `dateTo >= dateFrom`.
 */
export const GenerateReportRequestSchema = z
  .object({
    reportType: ReportTypeSchema,
    format: ReportFormatSchema,
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    projectId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.dateFrom || !data.dateTo) return true;
      return data.dateTo >= data.dateFrom;
    },
    {
      message: "Date To must not be before Date From",
      path: ["dateTo"],
    },
  );
export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;

export const ReportJobSchema = z
  .object({
    jobId: z.string(),
    status: ReportJobStatusSchema,
    reportType: ReportTypeSchema,
    format: ReportFormatSchema,
    parameters: z.unknown().optional(),
    result: z.unknown().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    downloadUrl: z.string().optional(),
    rowCount: z.number().optional(),
    createdAt: z.string(),
    completedAt: z.string().optional(),
  })
  .passthrough();
export type ReportJob = z.infer<typeof ReportJobSchema>;

export const ReportJobsResponseSchema = z.object({
  jobs: z.array(ReportJobSchema),
});
export type ReportJobsResponse = z.infer<typeof ReportJobsResponseSchema>;

/** POST /api/reports/jobs/[id]/run — trigger a queued report job. */
export const RunReportJobResponseSchema = z.object({
  jobId: z.string(),
  status: ReportJobStatusSchema,
});
export type RunReportJobResponse = z.infer<typeof RunReportJobResponseSchema>;

// --- Communications (feat-0012) ------------------------------------------

export const CommunicationChannelSchema = z.enum(["email", "sms", "whatsapp"]);
export type CommunicationChannel = z.infer<typeof CommunicationChannelSchema>;

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = [
  "email",
  "sms",
  "whatsapp",
];

export const CommunicationLogStatusSchema = z.enum([
  "queued",
  "sent",
  "delivered",
  "failed",
]);
export type CommunicationLogStatus = z.infer<
  typeof CommunicationLogStatusSchema
>;

export const COMMUNICATION_LOG_STATUSES: CommunicationLogStatus[] = [
  "queued",
  "sent",
  "delivered",
  "failed",
];

export const CommunicationTemplateSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    name: z.string(),
    channel: CommunicationChannelSchema,
    subject: z.string().nullable().optional(),
    bodyTemplate: z.string(),
    variables: z.array(z.string()).nullable().optional(),
    isActive: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type CommunicationTemplate = z.infer<typeof CommunicationTemplateSchema>;

export const CommunicationTemplatesResponseSchema = paginatedSchema(
  CommunicationTemplateSchema,
);
export type CommunicationTemplatesResponse = z.infer<
  typeof CommunicationTemplatesResponseSchema
>;

export const CommunicationLogSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    templateId: z.string().nullable().optional(),
    channel: CommunicationChannelSchema,
    recipient: z.string(),
    subject: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    status: CommunicationLogStatusSchema,
    error: z.string().nullable().optional(),
    sentAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type CommunicationLog = z.infer<typeof CommunicationLogSchema>;

export const CommunicationLogsResponseSchema = paginatedSchema(
  CommunicationLogSchema,
);
export type CommunicationLogsResponse = z.infer<
  typeof CommunicationLogsResponseSchema
>;

export const CreateTemplateRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  channel: CommunicationChannelSchema,
  subject: z
    .string()
    .max(300, "Subject must be 300 characters or fewer")
    .optional(),
  bodyTemplate: z
    .string()
    .min(1, "Body is required")
    .max(10000, "Body must be 10000 characters or fewer"),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  channel: CommunicationChannelSchema.optional(),
  subject: z.string().max(300).nullable().optional(),
  bodyTemplate: z.string().min(1).max(10000).optional(),
  variables: z.array(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

export const SendCommunicationRequestSchema = z.object({
  templateId: z.string().optional(),
  channel: CommunicationChannelSchema,
  recipient: z.string().min(1, "Recipient is required"),
  subject: z.string().optional(),
  body: z.string().optional(),
  variables: z.record(z.string(), z.string()).optional(),
});
export type SendCommunicationRequest = z.infer<
  typeof SendCommunicationRequestSchema
>;

// --- Support Tickets (feat-0013) -----------------------------------------

export const TicketStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
  "closed",
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;

export const TICKET_STATUSES: TicketStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export const TicketPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "urgent",
]);
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;

export const TICKET_PRIORITIES: TicketPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TicketReplySchema = z
  .object({
    id: z.string(),
    ticketId: z.string().optional(),
    authorId: z.string().nullable().optional(),
    authorName: z.string().nullable().optional(),
    body: z.string(),
    createdAt: z.string(),
  })
  .passthrough();
export type TicketReply = z.infer<typeof TicketReplySchema>;

export const SupportTicketSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    subject: z.string(),
    description: z.string().nullable().optional(),
    status: TicketStatusSchema,
    priority: TicketPrioritySchema,
    createdBy: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    replies: z.array(TicketReplySchema).optional(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type SupportTicket = z.infer<typeof SupportTicketSchema>;

export const SupportTicketsResponseSchema = paginatedSchema(SupportTicketSchema);
export type SupportTicketsResponse = z.infer<
  typeof SupportTicketsResponseSchema
>;

export const CreateTicketRequestSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be 200 characters or fewer"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(5000, "Description must be 5000 characters or fewer"),
  priority: TicketPrioritySchema,
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

export const CreateReplyRequestSchema = z.object({
  body: z
    .string()
    .min(1, "Reply cannot be empty")
    .max(5000, "Reply must be 5000 characters or fewer"),
});
export type CreateReplyRequest = z.infer<typeof CreateReplyRequestSchema>;

export const UpdateTicketStatusRequestSchema = z.object({
  status: TicketStatusSchema,
});
export type UpdateTicketStatusRequest = z.infer<
  typeof UpdateTicketStatusRequestSchema
>;

// --- Workflows (feat-0014) ------------------------------------------------

export const WorkflowTriggerEventSchema = z.enum([
  "lead_stage_changed",
  "booking_status_changed",
  "payment_due",
  "site_visit_scheduled",
  "task_due",
]);
export type WorkflowTriggerEvent = z.infer<typeof WorkflowTriggerEventSchema>;

export const WORKFLOW_TRIGGER_EVENTS: WorkflowTriggerEvent[] = [
  "lead_stage_changed",
  "booking_status_changed",
  "payment_due",
  "site_visit_scheduled",
  "task_due",
];

export const WorkflowSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    name: z.string(),
    triggerEvent: WorkflowTriggerEventSchema,
    isActive: z.boolean(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowsResponseSchema = paginatedSchema(WorkflowSchema);
export type WorkflowsResponse = z.infer<typeof WorkflowsResponseSchema>;

export const WorkflowExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
]);
export type WorkflowExecutionStatus = z.infer<
  typeof WorkflowExecutionStatusSchema
>;

export const WORKFLOW_EXECUTION_STATUSES: WorkflowExecutionStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
];

export const WorkflowExecutionSchema = z
  .object({
    id: z.string(),
    workflowId: z.string(),
    status: WorkflowExecutionStatusSchema,
    startedAt: z.string(),
    finishedAt: z.string().nullable().optional(),
    error: z.string().nullable().optional(),
    triggeredBy: z.string().nullable().optional(),
  })
  .passthrough();
export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

export const WorkflowExecutionsResponseSchema = paginatedSchema(
  WorkflowExecutionSchema,
);
export type WorkflowExecutionsResponse = z.infer<
  typeof WorkflowExecutionsResponseSchema
>;

export const CreateWorkflowRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  triggerEvent: WorkflowTriggerEventSchema,
  isActive: z.boolean().optional(),
});
export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const UpdateWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerEvent: WorkflowTriggerEventSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWorkflowRequest = z.infer<typeof UpdateWorkflowRequestSchema>;

// --- Webhooks (feat-0016) ------------------------------------------------

export const WebhookEndpointSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    url: z.string().url(),
    secret: z.string().optional(),
    events: z.array(z.string()),
    isActive: z.boolean(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>;

export const WebhookEndpointsResponseSchema = paginatedSchema(WebhookEndpointSchema);
export type WebhookEndpointsResponse = z.infer<typeof WebhookEndpointsResponseSchema>;

export const WebhookDeliveryStatusSchema = z.enum(["pending", "success", "failed"]);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

export const WEBHOOK_DELIVERY_STATUSES: WebhookDeliveryStatus[] = [
  "pending",
  "success",
  "failed",
];

export const WebhookDeliverySchema = z
  .object({
    id: z.string(),
    endpointId: z.string(),
    eventType: z.string(),
    status: WebhookDeliveryStatusSchema,
    attempts: z.number().int().nonnegative(),
    responseStatus: z.number().int().nullable().optional(),
    nextRetryAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .passthrough();
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;

export const WebhookDeliveriesResponseSchema = paginatedSchema(WebhookDeliverySchema);
export type WebhookDeliveriesResponse = z.infer<typeof WebhookDeliveriesResponseSchema>;

export const RegisterEndpointRequestSchema = z.object({
  url: z.string().url("Enter a valid URL"),
  secret: z.string().min(16, "Secret must be at least 16 characters"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});
export type RegisterEndpointRequest = z.infer<typeof RegisterEndpointRequestSchema>;

// --- Super Admin ----------------------------------------------------------

export const TenantPlanSchema = z.enum(["starter", "professional", "enterprise"]);
export type TenantPlan = z.infer<typeof TenantPlanSchema>;
export const TENANT_PLANS: TenantPlan[] = ["starter", "professional", "enterprise"];

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  plan: TenantPlanSchema,
  isActive: z.boolean(),
  maxUsers: z.number().optional(),
  maxProjects: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export type Tenant = z.infer<typeof TenantSchema>;

export const TenantsResponseSchema = paginatedSchema(TenantSchema);
export type TenantsResponse = z.infer<typeof TenantsResponseSchema>;

export const TenantStatsSchema = TenantSchema.extend({
  leadsCount: z.number().optional(),
  bookingsCount: z.number().optional(),
  usersCount: z.number().optional(),
}).passthrough();
export type TenantStats = z.infer<typeof TenantStatsSchema>;

export const SystemStatsSchema = z.object({
  totalTenants: z.number(),
  activeTenants: z.number(),
  totalLeads: z.number(),
  totalBookings: z.number(),
  totalRevenue: z.number().optional(),
}).passthrough();
export type SystemStats = z.infer<typeof SystemStatsSchema>;

export const CreateTenantRequestSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name must be 200 characters or fewer"),
  slug: z.string().min(1, "Slug is required").max(100, "Slug must be 100 characters or fewer").regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  plan: TenantPlanSchema,
});
export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;

export const UpdateTenantRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  plan: TenantPlanSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTenantRequest = z.infer<typeof UpdateTenantRequestSchema>;

// --- AI Price Prediction (feat-0022) --------------------------------------

export const PricePredictionResponseSchema = z.object({
  unitId: z.string(),
  estimatedPrice: z.number(),
  pricePerSqft: z.number(),
  confidence: z.number(),
  priceRange: z.object({
    low: z.number(),
    high: z.number(),
  }),
  adjustmentFactors: z.array(z.string()),
});
export type PricePredictionResponse = z.infer<typeof PricePredictionResponseSchema>;

// --- Customer Portal (feat-0018) ------------------------------------------

export const BookingStatusSchema = z.enum([
  "draft",
  "confirmed",
  "cancelled",
  "completed",
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const CustomerBookingSummarySchema = z.object({
  id: z.string(),
  bookingRef: z.string(),
  status: BookingStatusSchema,
  unitId: z.string(),
  totalAmount: z.string().nullable(),
  collectedAmount: z.string(),
  createdAt: z.string(),
}).passthrough();
export type CustomerBookingSummary = z.infer<typeof CustomerBookingSummarySchema>;

export const CustomerBookingsResponseSchema = z.array(CustomerBookingSummarySchema);
export type CustomerBookingsResponse = z.infer<typeof CustomerBookingsResponseSchema>;


export const MilestoneViewSchema = z.object({
  id: z.string(),
  sequenceOrder: z.number(),
  name: z.string(),
  percentage: z.string(),
  amountDue: z.string(),
  dueDate: z.string().nullable(),
  constructionTrigger: z.string().nullable(),
  status: MilestoneStatusSchema,
  amountPaid: z.string(),
}).passthrough();
export type MilestoneView = z.infer<typeof MilestoneViewSchema>;

export const PaymentScheduleViewSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  totalAmount: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  milestones: z.array(MilestoneViewSchema),
}).passthrough();
export type PaymentScheduleView = z.infer<typeof PaymentScheduleViewSchema>;

export const DocumentTypeSchema = z.enum([
  "agreement",
  "receipt",
  "noc",
  "brochure",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const CustomerDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DocumentTypeSchema,
  mimeType: z.string(),
  url: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  createdAt: z.string(),
}).passthrough();
export type CustomerDocument = z.infer<typeof CustomerDocumentSchema>;

export const CustomerDocumentsResponseSchema = z.array(CustomerDocumentSchema);
export type CustomerDocumentsResponse = z.infer<typeof CustomerDocumentsResponseSchema>;

export const VisitStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export type VisitStatus = z.infer<typeof VisitStatusSchema>;

export const CustomerSiteVisitSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  unitId: z.string().nullable(),
  scheduledAt: z.string(),
  status: VisitStatusSchema,
  notes: z.string().nullable(),
}).passthrough();
export type CustomerSiteVisit = z.infer<typeof CustomerSiteVisitSchema>;

export const CustomerSiteVisitsResponseSchema = z.array(CustomerSiteVisitSchema);
export type CustomerSiteVisitsResponse = z.infer<typeof CustomerSiteVisitsResponseSchema>;

// --- Commissions (feat-0031) ----------------------------------------------

export const CommissionStatusSchema = z.enum(["pending", "approved", "paid", "cancelled"]);
export type CommissionStatus = z.infer<typeof CommissionStatusSchema>;

export const CommissionSchema = z.object({
  id: z.string(),
  dealerId: z.string(),
  bookingId: z.string(),
  rate: z.string(),
  amount: z.string(),
  status: CommissionStatusSchema,
  paidAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
}).passthrough();
export type Commission = z.infer<typeof CommissionSchema>;

export const CommissionsResponseSchema = z.array(CommissionSchema);
export type CommissionsResponse = z.infer<typeof CommissionsResponseSchema>;

export const CommissionSummarySchema = z.object({
  dealerId: z.string(),
  totalCommissions: z.number(),
  totalAmount: z.number(),
  pendingAmount: z.number(),
  paidAmount: z.number(),
});
export type CommissionSummary = z.infer<typeof CommissionSummarySchema>;

export const HoldStatusSchema = z.enum(['active', 'released', 'converted', 'expired']);
export const HoldSchema = z.object({
  id: z.string(),
  tenantId: z.string().optional(),
  unitId: z.string(),
  leadId: z.string().nullable().optional(),
  heldBy: z.string().nullable().optional(),
  status: HoldStatusSchema,
  expiresAt: z.string(),
  expiredAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();
export type Hold = z.infer<typeof HoldSchema>;
export const HoldsResponseSchema = z.object({
  data: z.array(HoldSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export type HoldsResponse = z.infer<typeof HoldsResponseSchema>;

// --- Team Users ---------------------------------------------------------------

export const USER_ROLES = ["sales_manager", "sales_agent", "dealer"] as const;
export type UserRole = typeof USER_ROLES[number];

export const TeamUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string(),
  isActive: z.boolean().optional(),
  tenantId: z.string().optional(),
  createdAt: z.string().optional(),
});
export type TeamUser = z.infer<typeof TeamUserSchema>;

export const UsersResponseSchema = z.object({
  data: z.array(TeamUserSchema),
  total: z.number(),
});
export type UsersResponse = z.infer<typeof UsersResponseSchema>;

export const CreateUserRequestSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(USER_ROLES),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

// --- Internal AI assistant (Phase 2) --------------------------------------
// Client-facing shapes for the /api/assistant/chat BFF route. The user's JWT
// is NEVER part of this payload — the BFF injects it server-side from the
// httpOnly session cookie.

export const AssistantChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type AssistantChatMessage = z.infer<typeof AssistantChatMessageSchema>;

export const AssistantPageContextSchema = z.object({
  path: z.string().optional(),
  project_id: z.string().optional(),
  lead_id: z.string().optional(),
});
export type AssistantPageContext = z.infer<typeof AssistantPageContextSchema>;

export const AssistantChatRequestSchema = z.object({
  session_id: z.string().nullable().optional(),
  messages: z.array(AssistantChatMessageSchema),
  page_context: AssistantPageContextSchema.optional(),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantChatResponseSchema = z.object({
  session_id: z.string().nullable().optional(),
  reply: z.string(),
  suggested_questions: z.array(z.string()).default([]),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponseSchema>;

// --- Lead routing (feat-0047) ---------------------------------------------
// Mirrors reos-backend/src/lead-routing-rules/*:
//   lead-routing.constants.ts  → ROUTING_MODES, MIN/MAX_RULE_PRIORITY
//   dto/lead-routing-rule-response.dto.ts → LeadRoutingRuleSchema
//   dto/create|update|reorder-*.dto.ts    → the request schemas below
// `source: null` means "any source"; `projectId: null` means "any project".
// Lower `priority` = evaluated first.

export const ROUTING_MODES = ["round_robin", "rules"] as const;
export type RoutingMode = (typeof ROUTING_MODES)[number];
export const RoutingModeSchema = z.enum(ROUTING_MODES);

export const ROUTING_MODE_LABELS: Record<RoutingMode, string> = {
  round_robin: "Round robin",
  rules: "Rule based",
};

export const RoutingModeResponseSchema = z.object({
  routingMode: RoutingModeSchema,
});
export type RoutingModeResponse = z.infer<typeof RoutingModeResponseSchema>;

export const UpdateRoutingModeRequestSchema = z.object({
  routingMode: RoutingModeSchema,
});
export type UpdateRoutingModeRequest = z.infer<
  typeof UpdateRoutingModeRequestSchema
>;

/** Priority bounds accepted by the backend DTOs. */
export const MIN_RULE_PRIORITY = 0;
export const MAX_RULE_PRIORITY = 10_000;

export const LeadRoutingRuleSchema = z
  .object({
    id: z.string(),
    source: LeadSourceSchema.nullable(),
    projectId: z.string().nullable(),
    targetDealerId: z.string(),
    priority: z.number().int(),
    isActive: z.boolean(),
    createdBy: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type LeadRoutingRule = z.infer<typeof LeadRoutingRuleSchema>;

/**
 * The backend returns a bare array from `GET /lead-routing-rules`; the BFF
 * wraps it in the usual `{ data, total }` envelope before validating.
 */
export const LeadRoutingRulesResponseSchema =
  paginatedSchema(LeadRoutingRuleSchema);
export type LeadRoutingRulesResponse = z.infer<
  typeof LeadRoutingRulesResponseSchema
>;

export const CreateLeadRoutingRuleRequestSchema = z.object({
  source: LeadSourceSchema.nullable().optional(),
  projectId: z.string().uuid("Select a valid project").nullable().optional(),
  targetDealerId: z.string().uuid("Select an owner"),
  priority: z
    .number()
    .int()
    .min(MIN_RULE_PRIORITY)
    .max(MAX_RULE_PRIORITY)
    .optional(),
  isActive: z.boolean().optional(),
});
export type CreateLeadRoutingRuleRequest = z.infer<
  typeof CreateLeadRoutingRuleRequestSchema
>;

/**
 * PATCH body. `source: null` / `projectId: null` are MEANINGFUL (widen the rule
 * back to "any") and are distinct from omitting the key, which leaves the
 * column untouched — so both are nullable AND optional here, and the BFF must
 * forward an explicit null through untouched.
 */
export const UpdateLeadRoutingRuleRequestSchema = z.object({
  source: LeadSourceSchema.nullable().optional(),
  projectId: z.string().uuid("Select a valid project").nullable().optional(),
  targetDealerId: z.string().uuid("Select an owner").optional(),
  priority: z
    .number()
    .int()
    .min(MIN_RULE_PRIORITY)
    .max(MAX_RULE_PRIORITY)
    .optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLeadRoutingRuleRequest = z.infer<
  typeof UpdateLeadRoutingRuleRequestSchema
>;

export const ReorderLeadRoutingRuleItemSchema = z.object({
  id: z.string().uuid(),
  priority: z.number().int().min(MIN_RULE_PRIORITY).max(MAX_RULE_PRIORITY),
});
export type ReorderLeadRoutingRuleItem = z.infer<
  typeof ReorderLeadRoutingRuleItemSchema
>;

export const ReorderLeadRoutingRulesRequestSchema = z.object({
  rules: z.array(ReorderLeadRoutingRuleItemSchema).min(1).max(500),
});
export type ReorderLeadRoutingRulesRequest = z.infer<
  typeof ReorderLeadRoutingRulesRequestSchema
>;

// --- Bulk CSV lead import -------------------------------------------------
// Mirrors reos-backend/src/leads/dto/import-csv-result.dto.ts, returned by
// POST /leads/import/csv (multipart, field `file`). Per-row failures do NOT
// fail the request: rows land in `rejected` with `row` = spreadsheet line
// number (header = line 1) and the importer's reason string.

export const ImportCsvRejectionSchema = z.object({
  row: z.number().int(),
  reason: z.string(),
});
export type ImportCsvRejection = z.infer<typeof ImportCsvRejectionSchema>;

export const ImportCsvResultSchema = z.object({
  imported: z.number().int().nonnegative(),
  rejected: z.array(ImportCsvRejectionSchema),
});
export type ImportCsvResult = z.infer<typeof ImportCsvResultSchema>;
