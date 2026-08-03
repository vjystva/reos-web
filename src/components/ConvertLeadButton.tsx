"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useConvertLeadMutation } from "@/hooks/useConvertLeadMutation";
import type { LeadStage } from "@/types/api";

interface ConvertLeadButtonProps {
  leadId: string;
  stage: LeadStage;
  onSuccess?: () => void;
  className?: string;
}

export function ConvertLeadButton({ leadId, stage, onSuccess, className }: ConvertLeadButtonProps) {
  const mutation = useConvertLeadMutation();
  const isDisabled = stage === "booking" || stage === "lost" || mutation.isPending;

  const handleClick = () => {
    if (!window.confirm("Convert this lead to a booking?")) return;
    mutation.mutate(leadId, { onSuccess });
  };

  return (
    <Button type="button" onClick={handleClick} disabled={isDisabled} className={className}>
      {mutation.isPending ? "Converting…" : "Convert to Booking"}
    </Button>
  );
}
