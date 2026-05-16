"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/ProjectCard";
import { useProjects } from "@/hooks/useProjects";

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
      className="flex items-center justify-between text-sm text-slate-600"
    >
      <span>
        Page {page} of {totalPages} · {total} projects
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

function InventoryContent() {
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;

  const q = useProjects({ search, page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>
      </div>

      <ProjectSearch />

      {q.isError ? (
        <ErrorBanner
          message="Could not load projects."
          onRetry={() => q.refetch()}
        />
      ) : q.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (q.data?.data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No projects match your search.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {q.data!.data.map((p) => (
              <ProjectCard key={p.id} project={p} />
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
          <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-full animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 w-full animate-pulse rounded bg-slate-200"
              />
            ))}
          </div>
        </div>
      }
    >
      <InventoryContent />
    </Suspense>
  );
}
