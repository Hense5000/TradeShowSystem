import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Shared bits for every AI job (contact finder, events page finder, organizer
// finder, AI search): whether AI is set up, and how to explain its errors.

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Whether the Anthropic account has no credit left; every call then fails with error 400. */
function isOutOfCredit(error: unknown): boolean {
  return error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message);
}

/** An error that fails every exhibitor alike (bad key, busy service, no credit), so a run should stop rather than go on. */
export function stopsEveryRow(error: unknown): boolean {
  return error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.RateLimitError || isOutOfCredit(error);
}

export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key (ANTHROPIC_API_KEY) is not valid.";
  if (isOutOfCredit(error)) return "The Anthropic account behind ANTHROPIC_API_KEY has no credit left. Top it up under Billing at console.anthropic.com.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy or the credit is used up. Try again later.";
  if (error instanceof Anthropic.APIError) return `The AI service failed (error ${error.status}): ${error.message.slice(0, 200)}`;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "The website took too long to answer.";
  if (error instanceof Error && error.message) return error.message.slice(0, 300);
  return "Something went wrong.";
}
