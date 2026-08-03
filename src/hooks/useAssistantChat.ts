"use client";

import { useMutation } from "@tanstack/react-query";
import {
  AssistantChatResponseSchema,
  type AssistantChatRequest,
  type AssistantChatResponse,
} from "@/types/api";

async function postAssistantChat(
  body: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  const res = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("unauthorized");
  }

  if (res.status === 503) {
    throw new Error(
      "The AI assistant isn't configured yet. Ask an admin to set the API key.",
    );
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
    };
    throw new Error(err.detail ?? err.error ?? "Assistant request failed");
  }

  const data = await res.json();
  return AssistantChatResponseSchema.parse(data);
}

/**
 * Mutation hook for the internal AI assistant. Posts the running conversation
 * (plus optional page context) to the BFF, which forwards it to reos-ai-service
 * with the user's JWT. 401 → redirect to /login; 503 → "not configured".
 */
export function useAssistantChat() {
  return useMutation<AssistantChatResponse, Error, AssistantChatRequest>({
    mutationFn: postAssistantChat,
  });
}
