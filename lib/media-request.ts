/** One deadline covers both authorization and Python processing. */
export async function mediaRequest(body: Record<string, unknown>) {
  const signal = AbortSignal.timeout(60_000);
  async function post(path: string, payload: Record<string, unknown>, token?: string) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("Your session expired or access was denied. Sign in again, then retry.");
    }
    if (response.status === 413) throw new Error("Choose a file smaller than 2 MB.");
    if (response.status === 429) throw new Error("Too many requests. Wait a moment, then retry.");
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("File tools are temporarily unavailable. Please try again shortly.");
    }
    let result: Record<string, unknown>;
    try {
      const value: unknown = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      result = value as Record<string, unknown>;
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error("File tools returned an invalid response. Please try again.");
    }
    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "Unable to process this file. Please try again.");
    }
    return result;
  }
  try {
    const credentials = await post("/api/media-token", { action: body.action });
    if (typeof credentials.token !== "string" || !credentials.token) {
      throw new Error("Unable to authorize file tools. Sign in again, then retry.");
    }
    return await post("/api/media", body, credentials.token);
  } catch (error) {
    if (signal.aborted) throw new Error("File processing timed out. Try again or choose a smaller file.");
    if (error instanceof TypeError) throw new Error("Cannot reach file tools. Check your connection and try again.");
    throw error;
  }
}
