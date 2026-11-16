import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({limit:vi.fn()}));
vi.mock("@/lib/security/rate-limit",()=>({checkRateLimit:mocks.limit,MINUTE:60000}));
import { GET } from "./route";
beforeEach(()=>{vi.resetAllMocks();mocks.limit.mockResolvedValue(null)});
it("allows valid display names for older clients and prevents cached availability results",async()=>{
 const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=%20TUshar%20"));
 expect(await response.json()).toEqual({available:true});expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("does not need a user exclusion because all valid names can be shared",async()=>{
 const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar&excludeUserId=someone-else"));
 expect(await response.json()).toEqual({available:true});
});
it.each(["", "   ", "a".repeat(81)])("rejects invalid names: %s",async name=>{
 expect((await GET(new Request(`https://mono.test/api/auth/name-availability?${new URLSearchParams({name})}`))).status).toBe(400);
});
it("limits availability probes",async()=>{
 mocks.limit.mockResolvedValue("Slow down.");expect((await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar"))).status).toBe(429);
});
it("handles a rate-limit service failure without disclosing internals",async()=>{
 mocks.limit.mockRejectedValue(new Error("database"));const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar"));expect(response.status).toBe(503);expect(await response.json()).not.toHaveProperty("available");
});
