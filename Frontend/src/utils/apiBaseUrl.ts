const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

function resolveLocalApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const { hostname, port, protocol } = window.location;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!isLocalHost) {
    return "";
  }

  // In Vite dev we prefer the proxy. In local preview/static hosting there is no proxy,
  // so point directly to the backend dev server.
  if (import.meta.env.DEV && port === "5173") {
    return "";
  }

  return `${protocol}//${hostname}:5068`;
}

export const API_BASE_URL = configuredApiBaseUrl || resolveLocalApiBaseUrl();
