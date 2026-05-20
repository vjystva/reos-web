"use client";

import { useState } from "react";
import { useTenantsAdmin } from "@/hooks/useTenantsAdmin";
import { useSystemStats } from "@/hooks/useSystemStats";
import { useCreateTenantMutation } from "@/hooks/useCreateTenantMutation";
import { useUpdateTenantMutation } from "@/hooks/useUpdateTenantMutation";
import { useDeactivateTenantMutation } from "@/hooks/useDeactivateTenantMutation";
import {
  CreateTenantRequestSchema,
  UpdateTenantRequestSchema,
  TENANT_PLANS,
  Tenant,
  TenantPlan,
} from "@/types/api";

const PLAN_LABELS: Record<TenantPlan, string> = {
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value ?? "—"}</p>
    </div>
  );
}

function CreateTenantModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<TenantPlan>("starter");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateTenantMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = CreateTenantRequestSchema.safeParse({ name, slug, plan });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Validation error"); return; }
    create.mutate(result.data, {
      onSuccess: onClose,
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Create Tenant</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-corp" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Plan</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={plan} onChange={(e) => setPlan(e.target.value as TenantPlan)}>
              {TENANT_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
            <button type="submit" disabled={create.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTenantModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [name, setName] = useState(tenant.name);
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateTenantMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = UpdateTenantRequestSchema.safeParse({ name, plan });
    if (!result.success) { setError(result.error.issues[0]?.message ?? "Validation error"); return; }
    update.mutate({ id: tenant.id, ...result.data }, {
      onSuccess: onClose,
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Edit Tenant</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Plan</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={plan} onChange={(e) => setPlan(e.target.value as TenantPlan)}>
              {TENANT_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded">Cancel</button>
            <button type="submit" disabled={update.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50">
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const [planFilter, setPlanFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);

  const filters: { plan?: string; isActive?: boolean } = {};
  if (planFilter) filters.plan = planFilter;
  if (activeFilter !== "") filters.isActive = activeFilter === "true";

  const { data: tenants, isLoading: tenantsLoading } = useTenantsAdmin(filters);
  const { data: stats } = useSystemStats();
  const deactivate = useDeactivateTenantMutation();

  const handleDeactivate = (id: string, name: string) => {
    if (!confirm(`Deactivate tenant "${name}"?`)) return;
    deactivate.mutate(id);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">
          New Tenant
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tenants" value={stats?.totalTenants} />
        <StatCard label="Active Tenants" value={stats?.activeTenants} />
        <StatCard label="Total Leads" value={stats?.totalLeads} />
        <StatCard label="Total Bookings" value={stats?.totalBookings} />
      </div>

      <div className="flex gap-4 mb-4">
        <select className="border rounded px-3 py-1.5 text-sm" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="">All Plans</option>
          {TENANT_PLANS.map((p) => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
        </select>
        <select className="border rounded px-3 py-1.5 text-sm" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {tenantsLoading ? (
        <p className="text-gray-500 text-sm">Loading tenants…</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(tenants?.data ?? []).map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500">{t.slug}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                      {PLAN_LABELS[t.plan] ?? t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => setEditTenant(t)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    {t.isActive && (
                      <button onClick={() => handleDeactivate(t.id, t.name)} className="text-red-600 hover:underline text-xs">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(tenants?.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No tenants found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
      {editTenant && <EditTenantModal tenant={editTenant} onClose={() => setEditTenant(null)} />}
    </div>
  );
}
