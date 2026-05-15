import * as React from "react";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

/**
 * Login page. The form uses `useSearchParams` to read the `next` redirect
 * target, so it must be wrapped in a Suspense boundary (App Router build
 * constraint).
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight text-slate-900">REOS</p>
          <p className="text-sm text-slate-500">
            Real Estate Operating System
          </p>
        </div>
        <Suspense
          fallback={
            <div className="h-64 animate-pulse rounded-lg bg-white" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
