import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({current:vi.fn(),limit:vi.fn(),available:vi.fn()}));
vi.mock("@/lib/auth/current-user",()=>({getCurrentUser:mocks.current}));
vi.mock("@/lib/security/rate-limit",()=>({checkRateLimit:mocks.limit,MINUTE:60000}));
vi.mock("@/server/services/name-service",()=>({isNameAvailable:mocks.available}));
import { GET } from "./route";
beforeEach(()=>{vi.resetAllMocks();mocks.current.mockResolvedValue(null);mocks.limit.mockResolvedValue(null);mocks.available.mockResolvedValue(true)});
it("checks trimmed exact case and returns only a private noncached availability boolean",async()=>{
 const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=%20TUshar%20"));
 expect(mocks.available).toHaveBeenCalledWith("TUshar",undefined);expect(await response.json()).toEqual({available:true});expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("only excludes the authenticated user, ignoring an arbitrary client exclusion",async()=>{
 mocks.current.mockResolvedValue({id:"self"});mocks.available.mockResolvedValue(false);
 const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar&excludeUserId=someone-else"));
 expect(mocks.available).toHaveBeenCalledWith("Tushar","self");expect(await response.json()).toEqual({available:false});
});
it("rejects empty/oversized names without querying user data",async()=>{
 expect((await GET(new Request("https://mono.test/api/auth/name-availability?name="))).status).toBe(400);expect(mocks.available).not.toHaveBeenCalled();
});
it("limits availability probes",async()=>{
 mocks.limit.mockResolvedValue("Slow down.");expect((await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar"))).status).toBe(429);expect(mocks.available).not.toHaveBeenCalled();
});
it("never reports a name available during a database outage",async()=>{
 mocks.available.mockRejectedValue(new Error("database"));const response=await GET(new Request("https://mono.test/api/auth/name-availability?name=Tushar"));expect(response.status).toBe(503);expect(await response.json()).not.toHaveProperty("available");
});
