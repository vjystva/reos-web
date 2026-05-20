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
  tenantId: z.string().optional(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  stage: LeadStageSchema,
  temperature: LeadTemperatureSchema,
  aiScore: z.number().nullable().optional(),
  assignedDealer: LeadDealerSchema.nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  scoreBreakdown: LeadScoreBreakdownSchema.nullable().optional(),
  activity: z.array(LeadActivitySchema).nullable().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const LeadResponseSchema = z.object({ lead: LeadSchema });
export type LeadResponse = z.infer<typeof LeadResponseSchema>;

export const UpdateLeadRequestSchema = z.object({
  stage: LeadStageSchema.optional(),
  notes: z.string().max(2000, "Notes must be 2000 characters or fewer").optional(),
  assignedTo: z.string().optional(),
});
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;

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

export const DealerSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    region: z.string().optional(),
    commissionRate: z.number().optional(),
    status: DealerStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
export type Dealer = z.infer<typeof DealerSchema>;

export const DealersResponseSchema = z.object({
  dealers: z.array(DealerSchema),
});
export type DealersResponse = z.infer<typeof DealersResponseSchema>;

export const CreateDealerRequestSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z
    .string()
    .email("Enter a valid email address")
    .optional(),
  phone: z.string().optional(),
  region: z.string().optional(),
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
  region: z.string().optional(),
  commissionRate: z
    .number()
    .min(0, "Commission must be 0 or greater")
    .max(100, "Commission must be 100 or less")
    .optional(),
  status: DealerStatusSchema.optional(),
});
export type UpdateDealerRequest = z.infer<typeof UpdateDealerRequestSchema>;

// --- Reports & Exports (feat-0011) ---------------------------------------

export const ReportTypeSchema = z.enum([
  "leads",
  "bookings",
  "payments",
  "site_visits",
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const REPORT_TYPES: ReportType[] = [
  "leads",
  "bookings",
  "payments",
  "site_visits",
];

export const ReportFormatSchema = z.enum(["csv", "json"]);
export type ReportFormat = z.infer<typeof ReportFormatSchema>;

export const REPORT_FORMATS: ReportFormat[] = ["csv", "json"];

export const ReportJobStatusSchema = z.enum([
  "queued",
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

export const WorkflowTriggerTypeSchema = z.enum([
  "lead_created",
  "stage_changed",
  "booking_created",
  "payment_due",
  "site_visit_scheduled",
]);
export type WorkflowTriggerType = z.infer<typeof WorkflowTriggerTypeSchema>;

export const WORKFLOW_TRIGGER_TYPES: WorkflowTriggerType[] = [
  "lead_created",
  "stage_changed",
  "booking_created",
  "payment_due",
  "site_visit_scheduled",
];

export const WorkflowActionTypeSchema = z.enum([
  "send_notification",
  "send_email",
  "create_task",
  "update_lead_stage",
]);
export type WorkflowActionType = z.infer<typeof WorkflowActionTypeSchema>;

export const WORKFLOW_ACTION_TYPES: WorkflowActionType[] = [
  "send_notification",
  "send_email",
  "create_task",
  "update_lead_stage",
];

export const WorkflowActionSchema = z
  .object({
    actionType: WorkflowActionTypeSchema,
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;

export const WorkflowSchema = z
  .object({
    id: z.string(),
    tenantId: z.string().optional(),
    name: z.string(),
    triggerType: WorkflowTriggerTypeSchema,
    actions: z.array(WorkflowActionSchema),
    isActive: z.boolean(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type Workflow = z.infer<typeof WorkflowSchema>;

export const WorkflowsResponseSchema = paginatedSchema(WorkflowSchema);
export type WorkflowsResponse = z.infer<typeof WorkflowsResponseSchema>;

export const WorkflowExecutionStatusSchema = z.enum([
  "success",
  "failed",
  "partial",
  "running",
]);
export type WorkflowExecutionStatus = z.infer<
  typeof WorkflowExecutionStatusSchema
>;

export const WORKFLOW_EXECUTION_STATUSES: WorkflowExecutionStatus[] = [
  "success",
  "failed",
  "partial",
  "running",
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

export const CreateWorkflowActionRequestSchema = z.object({
  actionType: WorkflowActionTypeSchema,
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateWorkflowActionRequest = z.infer<
  typeof CreateWorkflowActionRequestSchema
>;

export const CreateWorkflowRequestSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be 200 characters or fewer"),
  triggerType: WorkflowTriggerTypeSchema,
  actions: z
    .array(CreateWorkflowActionRequestSchema)
    .min(1, "Add at least one action"),
  isActive: z.boolean().optional(),
});
export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

export const UpdateWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  triggerType: WorkflowTriggerTypeSchema.optional(),
  actions: z.array(CreateWorkflowActionRequestSchema).min(1).optional(),
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
  slug: z.string(),
  plan: TenantPlanSchema,
  isActive: z.boolean(),
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

export const MilestoneStatusSchema = z.enum([
  "pending",
  "due",
  "paid",
  "overdue",
  "waived",
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

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
