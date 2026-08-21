/** In-memory customer JWT for API client (avoid circular imports). */
let CURRENT_TOKEN: string | null = null;

export function getCustomerToken(): string | null {
  return CURRENT_TOKEN;
}

export function setCustomerToken(token: string | null): void {
  CURRENT_TOKEN = token;
}
