"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { ProjectCard } from "@/components/ProjectCard";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProjects } from "@/hooks/useProjects";
import { useCreateProjectMutation } from "@/hooks/useCreateProjectMutation";
import { useLead } from "@/hooks/useLead";
import type { CreateProjectRequest } from "@/types/api";

const PAGE_SIZE = 12;

function ProjectsPagination({
  page,
  total,
  pageSize,
}: {
  page: number;
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function goto(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between text-[11px] text-muted-foreground"
    >
      <span>
        Page{" "}
        <span className="font-mono tabular-nums text-foreground">{page}</span> of{" "}
        <span className="font-mono tabular-nums text-foreground">{totalPages}</span>{" "}
        · <span className="font-mono tabular-nums text-foreground">{total}</span>{" "}
        projects
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => goto(page - 1)}
          aria-label="Previous page"
        >
          ←
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => goto(page + 1)}
          aria-label="Next page"
        >
          →
        </Button>
      </div>
    </nav>
  );
}

function ProjectSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("search") ?? "";
  const [value, setValue] = React.useState(initial);

  // Sync the input when URL changes externally (e.g. Back).
  React.useEffect(() => {
    setValue(initial);
  }, [initial]);

  // Debounce 300ms before pushing to URL.
  React.useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) {
        next.set("search", value);
      } else {
        next.delete("search");
      }
      next.delete("page");
      const qs = next.toString();
      const target = `${pathname}${qs ? `?${qs}` : ""}`;
      // Avoid a no-op push that would still create a new history entry.
      if (`${pathname}${params.toString() ? `?${params.toString()}` : ""}` !== target) {
        router.push(target);
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="search"
      placeholder="Search projects..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label="Search projects"
    />
  );
}

/**
 * Conversion banner — shown when the user landed here from a lead's
 * "Convert to Booking" (`?leadId=…&intent=book`). There is no
 * lead→booking endpoint on the backend; a booking is created by
 * `POST /bookings` from the unit-selection flow, so this page is step 1.
 */
function ConversionBanner({ leadId }: { leadId: string }) {
  const leadQ = useLead(leadId);
  const who = leadQ.data?.name ?? "this lead";

  return (
    <div className="rounded-sm border border-accent/30 bg-accent/10 p-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Converting to booking
      </p>
      <p className="mt-1 text-xs text-foreground">
        Booking for <span className="font-medium">{who}</span> — open a project,
        then pick an available unit. The lead is carried through and
        pre-selected on the booking form.
      </p>
      <Link
        href={`/dashboard/leads/${encodeURIComponent(leadId)}`}
        className="mt-1.5 inline-block text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        ← Back to the lead
      </Link>
    </div>
  );
}

function InventoryContent() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const leadId = params.get("leadId");

  // Params that must survive the drill-down into a project (the conversion
  // context); pagination/search are page-local and deliberately dropped.
  const carryQuery = React.useMemo(() => {
    const next = new URLSearchParams();
    if (leadId) next.set("leadId", leadId);
    const intent = params.get("intent");
    if (intent) next.set("intent", intent);
    return next.toString();
  }, [leadId, params]);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const q = useProjects({ q: search, page, pageSize: PAGE_SIZE });
  const createMutation = useCreateProjectMutation();

  async function handleCreate(data: CreateProjectRequest) {
    setFormError(null);
    try {
      await createMutation.mutateAsync(data);
      setSheetOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Inventory"
        subtitle={
          q.isLoading
            ? "Projects and unit availability"
            : `${q.data?.total ?? 0} project${(q.data?.total ?? 0) !== 1 ? "s" : ""} · unit availability by project`
        }
        actions={
          <Button onClick={() => { setSheetOpen(true); setFormError(null); }}>
            + New project
          </Button>
        }
      />

      {leadId ? <ConversionBanner leadId={leadId} /> : null}

      <div className="max-w-sm">
        <ProjectSearch />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Create new project</SheetTitle>
            <SheetDescription>
              Add a new real estate project to your portfolio.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CreateProjectForm
              isSubmitting={createMutation.isPending}
              error={formError}
              onSubmit={(data) => void handleCreate(data)}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {q.isError ? (
        <ErrorBanner
          message="Could not load projects."
          onRetry={() => q.refetch()}
        />
      ) : q.isLoading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (q.data?.data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-xs text-muted-foreground">
          No projects match your search.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {q.data!.data.map((p) => (
              <ProjectCard key={p.id} project={p} carryQuery={carryQuery} />
            ))}
          </div>
          <ProjectsPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={q.data?.total ?? 0}
          />
        </>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-full max-w-sm" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
