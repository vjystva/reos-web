"use client";

import * as React from "react";
import { RegisterEndpointRequestSchema } from "@/types/api";
import type {
  WebhookEndpoint,
  WebhookDeliveryStatus,
} from "@/types/api";
import { useWebhookEndpoints } from "@/hooks/useWebhookEndpoints";
import { useWebhookDeliveries } from "@/hooks/useWebhookDeliveries";
import { useRegisterEndpointMutation } from "@/hooks/useRegisterEndpointMutation";
import { useDeleteEndpointMutation } from "@/hooks/useDeleteEndpointMutation";

const WEBHOOK_EVENTS = [
  "lead_created",
  "booking_created",
  "payment_recorded",
  "site_visit_scheduled",
] as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const STATUS_OPTIONS: Array<WebhookDeliveryStatus | ""> = [
  "",
  "pending",
  "success",
  "failed",
];

// ---------------------------------------------------------------------------
// Register Endpoint Modal
// ---------------------------------------------------------------------------

interface RegisterEndpointModalProps {
  isOpen: boolean;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: {
    url: string;
    secret: string;
    events: string[];
  }) => void;
}

function RegisterEndpointModal({
  isOpen,
  isPending,
  error,
  onClose,
  onSubmit,
}: RegisterEndpointModalProps) {
  const [url, setUrl] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [selectedEvents, setSelectedEvents] = React.useState<WebhookEvent[]>(
    [],
  );
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  function resetForm() {
    setUrl("");
    setSecret("");
    setSelectedEvents([]);
    setValidationError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    const result = RegisterEndpointRequestSchema.safeParse({
      url,
      secret,
      events: selectedEvents,
    });

    if (!result.success) {
      setValidationError(
        result.error.issues[0]?.message ?? "Validation failed",
      );
      return;
    }

    onSubmit(result.data);
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Register webhook endpoint"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Register endpoint
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {(error ?? validationError) && (
          <p
            role="alert"
            className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error ?? validationError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="ep-url"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Endpoint URL
            </label>
            <input
              id="ep-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="ep-secret"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Signing secret
              <span className="ml-1 text-slate-400">(min 16 chars)</span>
            </label>
            <input
              id="ep-secret"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="your-signing-secret"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">
              Events to subscribe
            </legend>
            <div className="space-y-1">
              {WEBHOOK_EVENTS.map((evt) => (
                <label key={evt} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt)}
                    onChange={() => toggleEvent(evt)}
                    className="rounded"
                  />
                  <span className="text-slate-700">
                    {evt.replace(/_/g, " ")}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Registering…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function DeliveryStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    success: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
  };
  const cls = colorMap[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-green-100 text-green-800"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const endpointsQuery = useWebhookEndpoints();
  const registerMutation = useRegisterEndpointMutation();
  const deleteMutation = useDeleteEndpointMutation();

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Delivery filter state
  const [filterEndpointId, setFilterEndpointId] = React.useState<string>("");
  const [filterStatus, setFilterStatus] = React.useState<string>("");
  const [deliveryPage, setDeliveryPage] = React.useState(1);

  const deliveriesQuery = useWebhookDeliveries({
    endpointId: filterEndpointId || undefined,
    status: filterStatus || undefined,
    page: deliveryPage,
  });

  const endpoints: WebhookEndpoint[] = endpointsQuery.data?.data ?? [];
  const deliveries = deliveriesQuery.data?.data ?? [];
  const deliveriesTotal = deliveriesQuery.data?.total ?? 0;

  async function handleRegister(data: {
    url: string;
    secret: string;
    events: string[];
  }) {
    setRegisterError(null);
    try {
      await registerMutation.mutateAsync(data);
      setIsModalOpen(false);
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Failed to register endpoint",
      );
    }
  }

  async function handleDelete(endpointId: string) {
    setDeleteError(null);
    setDeletingId(endpointId);
    try {
      await deleteMutation.mutateAsync(endpointId);
      if (filterEndpointId === endpointId) {
        setFilterEndpointId("");
      }
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete endpoint",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Webhook Management
          </h1>
          <p className="text-sm text-slate-500">
            Register endpoints and view delivery history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRegisterError(null);
            setIsModalOpen(true);
          }}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Register endpoint
        </button>
      </header>

      {deleteError && (
        <p
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {deleteError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left panel — endpoint list */}
        <section aria-label="Registered endpoints">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Registered endpoints
          </h2>

          {endpointsQuery.isError ? (
            <p
              role="alert"
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              Failed to load endpoints.{" "}
              <button
                type="button"
                onClick={() => void endpointsQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : endpointsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading endpoints…</p>
          ) : endpoints.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No endpoints registered. Click &ldquo;Register endpoint&rdquo; to
              add one.
            </div>
          ) : (
            <ul role="list" className="space-y-2">
              {endpoints.map((ep) => {
                const isDeleting = deletingId === ep.id;
                return (
                  <li
                    key={ep.id}
                    className="rounded-md border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-medium text-slate-900"
                          title={ep.url}
                        >
                          {ep.url}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ep.events.length} event
                          {ep.events.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ActiveBadge isActive={ep.isActive} />
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(ep.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Delete endpoint ${ep.url}`}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right panel — delivery history */}
        <section aria-label="Delivery history">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Delivery history
          </h2>

          {/* Filters */}
          <div className="mb-3 flex flex-wrap gap-2">
            <select
              value={filterEndpointId}
              onChange={(e) => {
                setFilterEndpointId(e.target.value);
                setDeliveryPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              aria-label="Filter by endpoint"
            >
              <option value="">All endpoints</option>
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.url.length > 40
                    ? `…${ep.url.slice(-37)}`
                    : ep.url}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setDeliveryPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </div>

          {deliveriesQuery.isError ? (
            <p
              role="alert"
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              Failed to load deliveries.{" "}
              <button
                type="button"
                onClick={() => void deliveriesQuery.refetch()}
                className="underline"
              >
                Retry
              </button>
            </p>
          ) : deliveriesQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading deliveries…</p>
          ) : deliveries.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
              No deliveries found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-600">
                        Event
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-600">
                        Status
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-600">
                        Attempts
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-600">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {d.eventType}
                        </td>
                        <td className="px-3 py-2">
                          <DeliveryStatusBadge status={d.status} />
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {d.attempts}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>{deliveriesTotal} total</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={deliveryPage <= 1}
                    onClick={() => setDeliveryPage((p) => p - 1)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>Page {deliveryPage}</span>
                  <button
                    type="button"
                    disabled={deliveries.length < 25}
                    onClick={() => setDeliveryPage((p) => p + 1)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <RegisterEndpointModal
        isOpen={isModalOpen}
        isPending={registerMutation.isPending}
        error={registerError}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(data) => void handleRegister(data)}
      />
    </div>
  );
}
