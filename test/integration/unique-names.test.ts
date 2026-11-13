import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { asUser } from "./auth-context";
vi.mock("@/lib/auth/current-user", async () => {
  const { prisma } = await import("@/lib/db/prisma");
  const { testUser } = await import("./auth-context");
  return { requireUser: async () => prisma.user.findUniqueOrThrow({ where: { id: testUser.getStore()! } }) };
});
import { prisma } from "@/lib/db/prisma";
import { registerUser } from "@/server/services/auth-service";
import { updateProfile } from "@/server/services/profile-service";
import { deleteAccount } from "@/server/services/account-service";
import { isNameAvailable } from "@/server/services/name-service";
import { upsertUserFromOAuthProfile } from "@/lib/auth/oauth/google";

let run:string;
const email=(label:string)=>`names-${run}-${label}@example.invalid`;
const account=(label:string,name:string)=>registerUser({name,email:email(label),password:"abcdef",confirmPassword:"abcdef"});
beforeEach(()=>{run=randomUUID()});
afterEach(async()=>{await prisma.user.deleteMany({where:{email:{startsWith:`names-${run}-`}}})});
afterAll(()=>prisma.$disconnect());

it("rejects an exact active duplicate while allowing Tushar, TUshar and tushar case variants",async()=>{
 const base=`Names ${run}`;
 const first=await account("a",`${base} Tushar`);
 await expect(account("duplicate",first.name)).rejects.toMatchObject({fieldErrors:{name:expect.any(Array)}});
 await account("b",`${base} TUshar`);await account("c",`${base} tushar`);
 expect(await isNameAvailable(first.name)).toBe(false);expect(await isNameAvailable(first.name,first.id)).toBe(true);
 await expect(prisma.user.create({data:{email:email("direct"),name:first.name}})).rejects.toMatchObject({code:"P2002"});
});
it("admits only one simultaneous registration for the same exact name",async()=>{
 const name=`Race ${run}`;
 const results=await Promise.allSettled([account("race-a",name),account("race-b",name)]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 const failed=results.find(r=>r.status==="rejected") as PromiseRejectedResult;
 expect(failed.reason).toMatchObject({fieldErrors:{name:expect.any(Array)}});
 expect(await prisma.user.count({where:{name,deletedAt:null}})).toBe(1);
});
it("enforces the name rule during profile edits while allowing the user's own unchanged name",async()=>{
 const first=await account("first",`Profile ${run}`),second=await account("second",`Other ${run}`);
 await expect(asUser(second.id,()=>updateProfile(second.id,{name:first.name}))).rejects.toMatchObject({fieldErrors:{name:expect.any(Array)}});
 await asUser(first.id,()=>updateProfile(first.id,{name:first.name}));
 await asUser(second.id,()=>updateProfile(second.id,{name:first.name.toLowerCase()}));
 await expect(asUser(second.id,()=>updateProfile(first.id,{name:`Foreign ${run}`}))).rejects.toMatchObject({httpStatus:403});
});
it("erases the deleted account's name and nickname, then immediately allows name reuse",async()=>{
 const first=await account("old",`Released ${run}`);await prisma.user.update({where:{id:first.id},data:{nickname:"Private nickname"}});
 await asUser(first.id,()=>deleteAccount(first.id));
 expect(await prisma.user.findUnique({where:{id:first.id},select:{name:true,nickname:true,deletedAt:true}})).toMatchObject({name:"Deleted account",nickname:null,deletedAt:expect.any(Date)});
 expect(await isNameAvailable(first.name)).toBe(true);await account("replacement",first.name);
});
it("gives a new OAuth identity a unique initial name without renaming an existing account",async()=>{
 const first=await account("existing",`OAuth ${run}`);
 const profile={provider:"GOOGLE" as const,providerAccountId:run,email:email("oauth"),name:first.name};
 const oauth=await upsertUserFromOAuthProfile(profile);
 expect(oauth.name).not.toBe(first.name);expect(oauth.name.startsWith(first.name)).toBe(true);
 expect((await upsertUserFromOAuthProfile(profile)).id).toBe(oauth.id);
 expect((await prisma.user.findUniqueOrThrow({where:{id:first.id}})).name).toBe(first.name);
});
