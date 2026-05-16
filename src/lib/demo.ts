import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "./api";
import type {
  User, MetricsResponse, Lead, LeadsResponse,
  Project, ProjectsResponse, Tower, TowersResponse,
  Unit, UnitsResponse, UnitPriceConfig,
  Booking, BookingsResponse,
} from "@/types/api";

export const DEMO_EMAIL = "admin@demo.com";
export const DEMO_PASSWORD = "admin123";

// Pre-computed JWT with exp: 9999999999 (never expires for demo purposes)
export const DEMO_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiJkZW1vLWFkbWluIiwiaWQiOiJkZW1vLWFkbWluIiwiZW1haWwiOiJhZG1pbkBkZW1vLmNvbSIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjoiZGVtby10ZW5hbnQiLCJuYW1lIjoiQWRtaW4gVXNlciIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ" +
  ".demo-sig";
export const DEMO_REFRESH_TOKEN = "demo-refresh-token";

export function isDemoRequest(req: NextRequest): boolean {
  return req.cookies.get(ACCESS_COOKIE)?.value === DEMO_ACCESS_TOKEN;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const DEMO_USER: User = {
  id: "demo-admin",
  email: DEMO_EMAIL,
  role: "admin",
  tenantId: "demo-tenant",
  name: "Admin User",
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export const DEMO_METRICS: MetricsResponse = {
  totalLeads: 42,
  hotLeads: 12,
  bookings: 8,
  units: { available: 156, blocked: 23, booked: 45 },
  failed: [],
};

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

const DEMO_LEADS_DATA: Lead[] = [
  {
    id: "lead-1", name: "Rahul Sharma", phone: "+91 98765 43210",
    email: "rahul.sharma@email.com", stage: "negotiation", temperature: "hot",
    aiScore: 87,
    assignedDealer: { id: "dealer-1", name: "Priya Singh" },
    createdAt: "2024-01-15T10:00:00Z",
    scoreBreakdown: { engagement: 30, budget: 25, timeline: 20, intent: 12 },
    activity: [
      { id: "a1", type: "call", description: "Discussed 3BHK pricing", occurredAt: "2024-01-20T14:00:00Z" },
      { id: "a2", type: "site_visit", description: "Visited Tower A show flat", occurredAt: "2024-01-18T11:00:00Z" },
    ],
  },
  {
    id: "lead-2", name: "Neha Patel", phone: "+91 87654 32109",
    email: "neha.patel@email.com", stage: "site_visit_done", temperature: "hot",
    aiScore: 79,
    assignedDealer: { id: "dealer-2", name: "Amit Kumar" },
    createdAt: "2024-01-18T09:00:00Z",
    scoreBreakdown: { engagement: 28, budget: 22, timeline: 18, intent: 11 },
    activity: [
      { id: "a3", type: "site_visit", description: "Liked the 2BHK east-facing unit", occurredAt: "2024-01-22T15:00:00Z" },
    ],
  },
  {
    id: "lead-3", name: "Vikram Nair", phone: "+91 76543 21098",
    email: "vikram.nair@email.com", stage: "booking", temperature: "hot",
    aiScore: 94,
    assignedDealer: { id: "dealer-1", name: "Priya Singh" },
    createdAt: "2024-01-10T08:00:00Z",
    scoreBreakdown: { engagement: 35, budget: 30, timeline: 18, intent: 11 },
    activity: [
      { id: "a4", type: "booking_initiated", description: "Token amount paid", occurredAt: "2024-01-25T10:00:00Z" },
    ],
  },
  {
    id: "lead-4", name: "Ananya Reddy", phone: "+91 65432 10987",
    email: "ananya.reddy@email.com", stage: "contacted", temperature: "warm",
    aiScore: 61,
    assignedDealer: { id: "dealer-2", name: "Amit Kumar" },
    createdAt: "2024-02-01T11:00:00Z",
    scoreBreakdown: { engagement: 20, budget: 18, timeline: 15, intent: 8 },
    activity: [
      { id: "a5", type: "call", description: "Initial enquiry about 2BHK", occurredAt: "2024-02-02T14:00:00Z" },
    ],
  },
  {
    id: "lead-5", name: "Suresh Iyer", phone: "+91 54321 09876",
    email: "suresh.iyer@email.com", stage: "site_visit_scheduled", temperature: "warm",
    aiScore: 55,
    assignedDealer: { id: "dealer-3", name: "Kavita Mehta" },
    createdAt: "2024-02-05T09:00:00Z",
    scoreBreakdown: { engagement: 18, budget: 15, timeline: 14, intent: 8 },
    activity: [
      { id: "a6", type: "call", description: "Scheduled site visit for Saturday", occurredAt: "2024-02-06T10:00:00Z" },
    ],
  },
  {
    id: "lead-6", name: "Meera Joshi", phone: "+91 43210 98765",
    email: "meera.joshi@email.com", stage: "new", temperature: "warm",
    aiScore: 48,
    assignedDealer: null,
    createdAt: "2024-02-08T12:00:00Z",
    scoreBreakdown: { engagement: 15, budget: 18, timeline: 10, intent: 5 },
    activity: [],
  },
  {
    id: "lead-7", name: "Deepak Verma", phone: "+91 32109 87654",
    email: "deepak.verma@email.com", stage: "new", temperature: "cold",
    aiScore: 32,
    assignedDealer: null,
    createdAt: "2024-02-10T14:00:00Z",
    scoreBreakdown: { engagement: 10, budget: 12, timeline: 7, intent: 3 },
    activity: [],
  },
  {
    id: "lead-8", name: "Sonal Gupta", phone: "+91 21098 76543",
    email: "sonal.gupta@email.com", stage: "contacted", temperature: "cold",
    aiScore: 29,
    assignedDealer: { id: "dealer-3", name: "Kavita Mehta" },
    createdAt: "2024-02-12T08:00:00Z",
    scoreBreakdown: { engagement: 8, budget: 10, timeline: 8, intent: 3 },
    activity: [
      { id: "a7", type: "email", description: "Sent brochure", occurredAt: "2024-02-13T09:00:00Z" },
    ],
  },
  {
    id: "lead-9", name: "Arjun Kapoor", phone: "+91 90123 45678",
    email: "arjun.kapoor@email.com", stage: "negotiation", temperature: "hot",
    aiScore: 82,
    assignedDealer: { id: "dealer-1", name: "Priya Singh" },
    createdAt: "2024-01-20T10:00:00Z",
    scoreBreakdown: { engagement: 28, budget: 24, timeline: 20, intent: 10 },
    activity: [
      { id: "a8", type: "call", description: "Counter offer discussed", occurredAt: "2024-01-28T16:00:00Z" },
    ],
  },
  {
    id: "lead-10", name: "Pooja Menon", phone: "+91 80234 56789",
    email: "pooja.menon@email.com", stage: "lost", temperature: "cold",
    aiScore: 20,
    assignedDealer: { id: "dealer-2", name: "Amit Kumar" },
    createdAt: "2024-01-05T09:00:00Z",
    scoreBreakdown: { engagement: 6, budget: 8, timeline: 4, intent: 2 },
    activity: [
      { id: "a9", type: "note", description: "Budget too low for current inventory", occurredAt: "2024-01-15T11:00:00Z" },
    ],
  },
  {
    id: "lead-11", name: "Rohan Desai", phone: "+91 70345 67890",
    email: "rohan.desai@email.com", stage: "site_visit_scheduled", temperature: "hot",
    aiScore: 75,
    assignedDealer: { id: "dealer-3", name: "Kavita Mehta" },
    createdAt: "2024-02-14T10:00:00Z",
    scoreBreakdown: { engagement: 25, budget: 22, timeline: 18, intent: 10 },
    activity: [
      { id: "a10", type: "call", description: "Confirmed visit for Sunday", occurredAt: "2024-02-15T09:00:00Z" },
    ],
  },
  {
    id: "lead-12", name: "Kavya Pillai", phone: "+91 60456 78901",
    email: "kavya.pillai@email.com", stage: "contacted", temperature: "warm",
    aiScore: 58,
    assignedDealer: { id: "dealer-1", name: "Priya Singh" },
    createdAt: "2024-02-16T11:00:00Z",
    scoreBreakdown: { engagement: 20, budget: 16, timeline: 14, intent: 8 },
    activity: [],
  },
];

export function getDemoLeads(searchParams: URLSearchParams): LeadsResponse {
  const temperature = searchParams.get("temperature");
  const stage = searchParams.get("stage");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");
  const page = parseInt(searchParams.get("page") ?? "1");

  let filtered = DEMO_LEADS_DATA;
  if (temperature) filtered = filtered.filter((l) => l.temperature === temperature);
  if (stage) filtered = filtered.filter((l) => l.stage === stage);

  const start = (page - 1) * pageSize;
  return { data: filtered.slice(start, start + pageSize), total: filtered.length };
}

export function getDemoLead(id: string): Lead | null {
  return DEMO_LEADS_DATA.find((l) => l.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const DEMO_PROJECTS_DATA: Project[] = [
  {
    id: "proj-1", name: "Skyline Residences", type: "apartment",
    city: "Mumbai", launchDate: "2023-01-15", possessionDate: "2026-06-30",
    isActive: true, createdAt: "2023-01-10T00:00:00Z", tenantId: "demo-tenant",
  },
  {
    id: "proj-2", name: "Green Valley Villas", type: "villa",
    city: "Pune", launchDate: "2023-06-01", possessionDate: "2027-03-31",
    isActive: true, createdAt: "2023-05-20T00:00:00Z", tenantId: "demo-tenant",
  },
  {
    id: "proj-3", name: "Sunrise Plots", type: "plotted",
    city: "Bangalore", launchDate: "2024-02-01", possessionDate: null,
    isActive: true, createdAt: "2024-01-15T00:00:00Z", tenantId: "demo-tenant",
  },
];

export function getDemoProjects(): ProjectsResponse {
  return { data: DEMO_PROJECTS_DATA, total: DEMO_PROJECTS_DATA.length };
}

export function getDemoProject(id: string): Project | null {
  return DEMO_PROJECTS_DATA.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------

const DEMO_TOWERS_DATA: Tower[] = [
  { id: "tower-1a", tenantId: "demo-tenant", projectId: "proj-1", name: "Tower A", totalFloors: 20, facing: "North", createdAt: "2023-01-10T00:00:00Z" },
  { id: "tower-1b", tenantId: "demo-tenant", projectId: "proj-1", name: "Tower B", totalFloors: 18, facing: "East", createdAt: "2023-01-10T00:00:00Z" },
  { id: "tower-2a", tenantId: "demo-tenant", projectId: "proj-2", name: "Block 1", totalFloors: 2, facing: "West", createdAt: "2023-05-20T00:00:00Z" },
];

export function getDemoTowers(projectId: string): TowersResponse {
  const towers = DEMO_TOWERS_DATA.filter((t) => t.projectId === projectId);
  return { data: towers, total: towers.length };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

function makeUnit(
  idx: number, projectId: string, towerId: string | null,
  floor: number, bedrooms: number, area: number, facing: string,
  isCorner: boolean, status: Unit["status"], pricePerSqft: number,
): Unit {
  const id = `unit-${projectId}-${idx}`;
  const towerPrefix = towerId ? towerId.split("-").pop()!.toUpperCase() : "P";
  return {
    id,
    unitNumber: `${towerPrefix}-${floor}0${idx % 4 + 1}`,
    floor, bedrooms, area, facing, isCorner,
    towerId: towerId ?? null,
    projectId,
    status,
    effectivePrice: Math.round(area * pricePerSqft),
  };
}

const DEMO_UNITS_DATA: Unit[] = [
  // Tower A (proj-1) — 12 units across floors
  makeUnit(1,  "proj-1", "tower-1a",  3, 2,  950,  "North", false, "available",  12000),
  makeUnit(2,  "proj-1", "tower-1a",  3, 3, 1350,  "East",  true,  "available",  13500),
  makeUnit(3,  "proj-1", "tower-1a",  5, 2,  950,  "North", false, "booked",     12000),
  makeUnit(4,  "proj-1", "tower-1a",  5, 3, 1350,  "East",  false, "available",  13500),
  makeUnit(5,  "proj-1", "tower-1a",  8, 2,  950,  "North", false, "blocked",    12000),
  makeUnit(6,  "proj-1", "tower-1a",  8, 4, 1850,  "North", true,  "available",  14000),
  makeUnit(7,  "proj-1", "tower-1a", 10, 2,  950,  "South", false, "available",  12500),
  makeUnit(8,  "proj-1", "tower-1a", 10, 3, 1350,  "West",  false, "sold",       13500),
  makeUnit(9,  "proj-1", "tower-1a", 12, 3, 1350,  "East",  true,  "available",  14000),
  makeUnit(10, "proj-1", "tower-1a", 15, 4, 1850,  "North", false, "available",  15000),
  makeUnit(11, "proj-1", "tower-1a", 18, 4, 1850,  "East",  true,  "available",  16000),
  makeUnit(12, "proj-1", "tower-1a", 20, 4, 2100,  "North", true,  "held",       18000),
  // Tower B (proj-1) — 6 units
  makeUnit(13, "proj-1", "tower-1b",  2, 2,  900, "East",   false, "available",  11500),
  makeUnit(14, "proj-1", "tower-1b",  2, 2,  900, "West",   false, "available",  11500),
  makeUnit(15, "proj-1", "tower-1b",  6, 3, 1300, "East",   false, "booked",     13000),
  makeUnit(16, "proj-1", "tower-1b",  6, 3, 1300, "West",   true,  "available",  13500),
  makeUnit(17, "proj-1", "tower-1b", 12, 4, 1800, "East",   false, "available",  14500),
  makeUnit(18, "proj-1", "tower-1b", 18, 4, 1800, "North",  true,  "available",  16000),
  // proj-2 villas — 6 units, no tower
  makeUnit(19, "proj-2", null, 1, 4, 3200, "West",  true,  "available",  8000),
  makeUnit(20, "proj-2", null, 1, 3, 2400, "North", false, "available",  7500),
  makeUnit(21, "proj-2", null, 1, 4, 3200, "East",  true,  "booked",     8000),
  makeUnit(22, "proj-2", null, 2, 3, 2400, "South", false, "available",  7500),
  makeUnit(23, "proj-2", null, 2, 4, 3600, "North", true,  "available",  8500),
  makeUnit(24, "proj-2", null, 2, 4, 3600, "East",  false, "sold",       8500),
  // proj-3 plots — 6 units, no tower
  makeUnit(25, "proj-3", null, 1, 0,  1200, "North", false, "available",  4500),
  makeUnit(26, "proj-3", null, 1, 0,  1500, "East",  true,  "available",  4800),
  makeUnit(27, "proj-3", null, 1, 0,  2000, "West",  false, "booked",     4500),
  makeUnit(28, "proj-3", null, 1, 0,  1200, "South", false, "available",  4500),
  makeUnit(29, "proj-3", null, 1, 0,  1800, "North", true,  "sold",       4800),
  makeUnit(30, "proj-3", null, 1, 0,  2400, "East",  false, "available",  5000),
];

export function getDemoUnits(projectId: string, searchParams: URLSearchParams): UnitsResponse {
  const status = searchParams.get("status");
  const towerId = searchParams.get("towerId");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  let units = DEMO_UNITS_DATA.filter((u) => u.projectId === projectId);
  if (status) units = units.filter((u) => u.status === status);
  if (towerId) units = units.filter((u) => u.towerId === towerId);

  return { data: units.slice(0, pageSize), total: units.length };
}

export function getDemoAllUnits(searchParams: URLSearchParams): UnitsResponse {
  const status = searchParams.get("status");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50");

  let units = DEMO_UNITS_DATA;
  if (status) units = units.filter((u) => u.status === status);

  return { data: units.slice(0, pageSize), total: units.length };
}

export function getDemoPriceConfig(unitId: string): UnitPriceConfig | null {
  const unit = DEMO_UNITS_DATA.find((u) => u.id === unitId);
  if (!unit || !unit.area || !unit.effectivePrice) return null;
  const base = Math.round(unit.area * 10000);
  const floorPrem = (unit.floor ?? 1) * 50000;
  const facingPrem = unit.facing === "North" || unit.facing === "East" ? 100000 : 0;
  const cornerPrem = unit.isCorner ? 150000 : 0;
  const discount = 50000;
  return {
    id: `pc-${unitId}`,
    unitId,
    basePrice: base,
    floorPremium: floorPrem,
    facingPremium: facingPrem,
    cornerPremium: cornerPrem,
    discount,
    effectivePrice: base + floorPrem + facingPrem + cornerPrem - discount,
  };
}

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

const DEMO_BOOKINGS_DATA: Booking[] = [
  { id: "bk-1", leadId: "lead-3", createdAt: "2024-01-25T10:00:00Z" },
  { id: "bk-2", leadId: "lead-9", createdAt: "2024-01-29T14:00:00Z" },
  { id: "bk-3", leadId: "lead-2", createdAt: "2024-02-03T11:00:00Z" },
];

export function getDemoBookings(): BookingsResponse {
  return { data: DEMO_BOOKINGS_DATA, total: DEMO_BOOKINGS_DATA.length };
}
