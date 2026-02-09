import accessTokens from "../../data/access_tokens.json";

type AccessTokenEntry = {
  token: string;
  device: string;
  enabled?: boolean;
};

const tokens = accessTokens as AccessTokenEntry[];

export function listAccessTokens(): AccessTokenEntry[] {
  return tokens;
}

export function findAccessToken(token?: string | null): AccessTokenEntry | null {
  if (!token) return null;
  return tokens.find((entry) => entry.enabled !== false && entry.token === token) ?? null;
}

export function isAccessTokenValid(token?: string | null): boolean {
  return Boolean(findAccessToken(token));
}
