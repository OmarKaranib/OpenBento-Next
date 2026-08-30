import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /health", () => {
  it("returns 200 with a static ok body and no secrets or env", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/SUPABASE|SERVICE_ROLE|SECRET|TOKEN|process\.env/i);
    expect(Object.keys(body)).toEqual(["ok"]);
  });
});
