"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoginRequestSchema } from "@/types/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<"email" | "password", string>>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const passwordRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0];
        if (k === "email" || k === "password") fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 401) {
        setSubmitError("Incorrect email or password. Please try again.");
        passwordRef.current?.focus();
        return;
      }
      if (!res.ok) {
        setSubmitError(
          "Unable to reach the server. Check your connection and try again.",
        );
        return;
      }
      router.push(nextHref);
    } catch {
      setSubmitError(
        "Unable to reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      noValidate
    >
      <h1 className="text-center text-xl font-semibold text-slate-900">
        Sign in to REOS
      </h1>

      <div className="space-y-1">
        <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-label="Email address"
          aria-invalid={errors.email ? true : undefined}
          required
        />
        {errors.email ? (
          <p className="text-xs text-red-600">{errors.email}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <Input
            id="login-password"
            ref={passwordRef}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            aria-label="Password"
            aria-invalid={errors.password ? true : undefined}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-red-600">{errors.password}</p>
        ) : null}
      </div>

      {submitError ? (
        <ErrorBanner message={submitError} />
      ) : null}

      <Button
        type="submit"
        disabled={submitting}
        aria-label="Sign In"
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-label="Signing in…"
            />
            Signing in…
          </>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );
}
