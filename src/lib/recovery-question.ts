export const DEFAULT_RECOVERY_QUESTION =
  "What is the admin recovery password?";
export const SUGGESTED_RECOVERY_QUESTION =
  "What private phrase did you choose for Kopi recovery?";

export function normalizedAnswer(answer: string) {
  return answer.trim().normalize("NFKC").toLowerCase();
}
