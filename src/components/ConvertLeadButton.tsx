"use client";
import * as React from "react";
import { useConvertLeadMutation } from "@/hooks/useConvertLeadMutation";
import type { LeadStage } from "@/types/api";

interface ConvertLeadButtonProps {
  leadId: string;
  stage: LeadStage;
  onSuccess?: () => void;
}

export function ConvertLeadButton({ leadId, stage, onSuccess }: ConvertLeadButtonProps) {
  const mutation = useConvertLeadMutation();
  const isDisabled = stage === "booking" || stage === "lost" || mutation.isPending;

  const handleClick = () => {
    if (!window.confirm("Convert this lead to a booking?")) return;
    mutation.mutate(leadId, { onSuccess });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {mutation.isPending ? "Converting…" : "Convert to Booking"}
    </button>
  );
}
