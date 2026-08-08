/**
 * Dealers (channel partner) import config.
 *
 * Backend: `POST /dealers/import/csv`
 * (`@Roles('builder_admin','sales_manager')`) via BFF
 * `POST /api/dealers/import`.
 *
 * Rows are coerced into the same `CreateDealerDto` the JSON `POST /dealers`
 * body uses, so the bounds below are that DTO's class-validator constraints.
 *
 * `email` is unique per tenant (`uq_dealers_tenant_email`) — a collision with
 * an EXISTING dealer is a per-row 409 the client cannot see in advance, and
 * comes back as a rejection reason. In-file collisions are caught here.
 *
 * A blank `kyc_status` is left to the DB default (`pending`, migration 027) —
 * the column is emitted blank rather than filled in client-side.
 */

import type { EntityImportConfig } from "./types";
import { emailCell, maxLenCell, numberCell } from "./validators";

/** `DEALER_KYC_STATUSES` in reos-backend/src/dealers/dealers.constants.ts. */
export const DEALER_KYC_STATUSES = ["pending", "verified", "rejected"] as const;

export const dealersImportConfig: EntityImportConfig = {
  key: "dealers",
  label: "Dealers",
  noun: { one: "dealer", many: "dealers" },
  description:
    "Onboards channel partners. Email must be unique per tenant; a blank KYC status defaults to pending.",
  fields: [
    {
      key: "name",
      label: "Name",
      required: true,
      aliases: ["dealer name", "partner name", "full name", "contact name"],
      validate: maxLenCell("Name", 255),
    },
    {
      key: "email",
      label: "Email",
      required: true,
      aliases: ["e-mail", "email address", "mail"],
      validate: (v) => emailCell("Email")(v) ?? maxLenCell("Email", 320)(v),
    },
    {
      key: "phone",
      label: "Phone",
      required: false,
      aliases: ["mobile", "mobile number", "phone number", "contact number"],
      validate: maxLenCell("Phone", 50),
    },
    {
      key: "company",
      label: "Company",
      required: false,
      aliases: ["firm", "agency", "organisation", "organization"],
      validate: maxLenCell("Company", 255),
    },
    {
      key: "commission_rate",
      label: "Commission rate",
      required: false,
      hint: "Percentage 0–100, up to 2 decimal places",
      aliases: ["commission", "commission %", "brokerage", "rate"],
      validate: numberCell("Commission rate", {
        min: 0,
        max: 100,
        maxDecimals: 2,
      }),
    },
    {
      key: "rera_id",
      label: "RERA id",
      required: false,
      hint: "Free-form — formats vary by state",
      aliases: ["rera", "rera number", "rera registration"],
      validate: maxLenCell("RERA id", 64),
    },
    {
      key: "kyc_status",
      label: "KYC status",
      required: false,
      hint: "Blank defaults to pending",
      aliases: ["kyc", "kyc state", "verification status"],
      validate: (v) =>
        DEALER_KYC_STATUSES.some((s) => s === v.toLowerCase())
          ? null
          : `KYC status must be one of ${DEALER_KYC_STATUSES.join(" | ")}`,
    },
  ],
  sampleCsv: [
    "Dealer Name,Email Address,Mobile Number,Firm,Commission %,RERA Number,KYC",
    "Rohit Malhotra,rohit.malhotra@partners.example.com,+91 98111 22334,Malhotra Realty,2.5,RERA-KA-1188,verified",
    "Sneha Rao,sneha.rao@partners.example.com,+91 98222 33445,Rao Properties,1.75,RERA-KA-2291,pending",
    "Imtiaz Khan,imtiaz.khan@partners.example.com,+91 98333 44556,Khan Estates,3,RERA-KA-3374,",
    // Deliberately invalid: commission rate is above the 0–100 range.
    "Bad Row,bad.row@partners.example.com,+91 98444 55667,Bad Realty,250,RERA-KA-9999,pending",
  ].join("\n"),
  sampleFileName: "sample-dealers.csv",
  uploadFileName: "dealers.csv",
  placeholder:
    "name,email,phone,company,commission_rate\nRohit Malhotra,rohit@partners.example.com,+91 98111 22334,Malhotra Realty,2.5",
  endpoint: () => "/api/dealers/import",
  invalidateKeys: ["dealers", "metrics"],
  dedupe: {
    key: (v) => v.email.toLowerCase(),
    hint: "same email twice in this file",
    noun: "email",
  },
  previewColumns: () => [
    {
      header: "Name",
      className: "font-medium text-foreground",
      render: (row) => row.values.name || "—",
    },
    {
      header: "Email",
      className: "text-muted-foreground",
      render: (row) => row.values.email || "—",
    },
    {
      header: "Phone",
      className: "font-mono",
      render: (row) => row.values.phone || "—",
    },
    {
      header: "Company",
      className: "text-muted-foreground",
      render: (row) => row.values.company || "—",
    },
    {
      header: "Commission",
      numeric: true,
      className: "text-muted-foreground",
      render: (row) =>
        row.values.commission_rate ? `${row.values.commission_rate}%` : "—",
    },
    {
      header: "KYC",
      className: "text-muted-foreground",
      render: (row) => row.values.kyc_status || "pending",
    },
  ],
  previewNote: (
    <>
      Duplicate detection here is in-file only. A dealer whose email already
      exists in this tenant is rejected server-side per row (
      <code>uq_dealers_tenant_email</code>) without affecting the other rows.
    </>
  ),
  resultNote: () => (
    <>
      Imported dealers are active immediately and appear under Dealers. A blank
      KYC status is stored as <code>pending</code>.
    </>
  ),
};
