const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "";

export const buildEndpointUrl = (path: string) =>
  API_BASE_URL ? `${API_BASE_URL}${path}` : path;

const POSSIBLE_TOKEN_KEYS = [
  "token",
  "conversationToken",
  "conversation_token",
] as const;

type TokenPayload = Partial<
  Record<(typeof POSSIBLE_TOKEN_KEYS)[number], unknown>
>;

export const getTokenFromResponse = (payload: TokenPayload) => {
  for (const key of POSSIBLE_TOKEN_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return undefined;
};
