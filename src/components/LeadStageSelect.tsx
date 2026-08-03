"use client";
import * as React from "react";
import { Select } from "@/components/ui/select";
import { LEAD_STAGES, type LeadStage } from "@/types/api";
import { stageLabel } from "@/lib/utils";

interface LeadStageSelectProps {
  value: LeadStage;
  onChange: (stage: LeadStage) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function LeadStageSelect({
  value,
  onChange,
  disabled,
  className,
  id,
}: LeadStageSelectProps) {
  return (
    <Select
      id={id}
      className={className}
      aria-label="Lead stage"
      value={value}
      onChange={(e) => onChange(e.target.value as LeadStage)}
      disabled={disabled}
    >
      {LEAD_STAGES.map((s) => (
        <option key={s} value={s}>
          {stageLabel(s)}
        </option>
      ))}
    </Select>
  );
}
