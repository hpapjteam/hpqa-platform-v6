/**
 * URL State Preservation & Post-Login Redirect Utility
 * Handles preserving target paths and query parameters (such as campaign IDs,
 * folder selections, tab states, and filters) across authentication sessions,
 * ensuring seamless redirection after login.
 */

const REDIRECT_STORAGE_KEY = "hp_post_login_redirect_url";

/**
 * Validates that a path is a safe, relative URL to prevent open-redirect exploits.
 */
export function isValidRedirectUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false; // Prevents protocol-relative cross-domain redirects
  if (trimmed.startsWith("/login") || trimmed.startsWith("/signup")) return false;
  return true;
}

/**
 * Saves the current or specified path, query parameters, and hash before redirecting to login.
 */
export function savePreLoginRedirectUrl(customUrl?: string): void {
  try {
    const rawUrl = customUrl || (window.location.pathname + window.location.search + window.location.hash);
    if (!rawUrl || rawUrl === "/" || !isValidRedirectUrl(rawUrl)) {
      return;
    }
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, rawUrl);
    localStorage.setItem(REDIRECT_STORAGE_KEY, rawUrl);
  } catch (e) {
    console.warn("[UrlRedirect] Unable to save pre-login URL state:", e);
  }
}

/**
 * Retrieves the post-login target URL with all preserved query parameters intact.
 * Priorities:
 * 1. Query parameter `redirect` or `next` in current URL
 * 2. SessionStorage cached URL
 * 3. LocalStorage cached URL
 * 4. Fallback root `/`
 */
export function getPostLoginRedirectUrl(): string {
  try {
    // 1. Check URL query parameters
    const searchParams = new URLSearchParams(window.location.search);
    const redirectParam = searchParams.get("redirect") || searchParams.get("next");
    if (redirectParam) {
      const decoded = decodeURIComponent(redirectParam);
      if (isValidRedirectUrl(decoded)) {
        return decoded;
      }
    }

    // 2. Check SessionStorage
    const storedSession = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    if (storedSession && isValidRedirectUrl(storedSession)) {
      return storedSession;
    }

    // 3. Check LocalStorage
    const storedLocal = localStorage.getItem(REDIRECT_STORAGE_KEY);
    if (storedLocal && isValidRedirectUrl(storedLocal)) {
      return storedLocal;
    }
  } catch (e) {
    console.warn("[UrlRedirect] Error reading post-login redirect URL:", e);
  }

  return "/";
}

/**
 * Clears stored redirect URL from browser storage.
 */
export function clearPostLoginRedirectUrl(): void {
  try {
    sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
    localStorage.removeItem(REDIRECT_STORAGE_KEY);
  } catch (e) {}
}

/**
 * Executes post-login navigation to the preserved path and query parameters,
 * then clears stored redirect state.
 */
export function executePostLoginRedirect(navigate?: (path: string) => void): string {
  const targetUrl = getPostLoginRedirectUrl();
  clearPostLoginRedirectUrl();

  if (navigate) {
    navigate(targetUrl);
  } else {
    window.location.href = targetUrl;
  }
  return targetUrl;
}

/**
 * Helper utility to parse query parameters from a URL path or query string into a key-value object.
 */
export function parseUrlQueryParams(urlOrPath?: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    let searchPart = "";
    if (urlOrPath) {
      const parts = urlOrPath.split("?");
      if (parts.length > 1) {
        searchPart = parts[1].split("#")[0];
      }
    } else {
      searchPart = window.location.search.slice(1);
    }

    if (searchPart) {
      const params = new URLSearchParams(searchPart);
      params.forEach((value, key) => {
        result[key] = value;
      });
    }
  } catch (e) {
    console.warn("[UrlRedirect] Error parsing query parameters:", e);
  }
  return result;
}
