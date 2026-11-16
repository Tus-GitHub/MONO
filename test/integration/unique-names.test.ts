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
import { upsertUserFromOAuthProfile } from "@/lib/auth/oauth/google";
import { isRegistrationEmailAvailable } from "@/server/services/email-availability-service";

let run:string;
let createdIds:string[];
const email=(label:string)=>`names-${run}-${label}@example.invalid`;
const account=async(label:string,name:string)=>{const user=await registerUser({name,email:email(label),password:"abcdef",confirmPassword:"abcdef"});createdIds.push(user.id);return user};
beforeEach(()=>{run=randomUUID();createdIds=[]});
afterEach(async()=>{await prisma.user.deleteMany({where:{OR:[{id:{in:createdIds}},{email:{in:["email","unused","email-race","a","duplicate","b","c","direct","race-a","race-b","first","second","old","replacement","existing","oauth"].map(email)}}]}})});
afterAll(()=>prisma.$disconnect());

it("blocks active duplicate emails and releases a closed account's former email", async () => {
 const first = await account("email", `Email ${run}`);
 expect(await isRegistrationEmailAvailable(`  ${first.email.toUpperCase()}  `)).toBe(false);
 expect(await isRegistrationEmailAvailable(email("unused"))).toBe(true);
 await expect(registerUser({name:first.name,email:first.email.toUpperCase(),password:"abcdef",confirmPassword:"abcdef"})).rejects.toMatchObject({fieldErrors:{email:expect.any(Array)}});
 await expect(prisma.user.create({data:{email:first.email.toUpperCase(),name:first.name}})).rejects.toMatchObject({code:"P2002"});
 await asUser(first.id,()=>deleteAccount(first.id));
 expect(await isRegistrationEmailAvailable(first.email)).toBe(true);
 const replacement=await registerUser({name:first.name,email:first.email.toUpperCase(),password:"newpass",confirmPassword:"newpass"});
 expect(replacement.id).not.toBe(first.id);
 expect((await prisma.user.findUniqueOrThrow({where:{id:first.id}})).deletedAt).not.toBeNull();
});

it("keeps email duplicate errors field-specific when two registrations race", async () => {
 const input = { email:email("email-race"),password:"abcdef",confirmPassword:"abcdef" };
 const results = await Promise.allSettled([
  registerUser({...input,name:`Same name ${run}`}), registerUser({...input,email:input.email.toUpperCase(),name:`Same name ${run}`}),
 ]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 const failed = results.find(r=>r.status==="rejected") as PromiseRejectedResult;
 expect(failed.reason).toMatchObject({fieldErrors:{email:expect.any(Array)}});
});

it("allows exact duplicate display names as well as capitalization variants",async()=>{
 const base=`Names ${run}`;
 const first=await account("a",`${base} Tushar`);
 const duplicate=await account("duplicate",first.name);
 expect(duplicate.id).not.toBe(first.id);expect(duplicate.name).toBe(first.name);
 await account("b",`${base} TUshar`);await account("c",`${base} tushar`);
 await prisma.user.create({data:{email:email("direct"),name:first.name}});
 expect(await prisma.user.count({where:{name:first.name,deletedAt:null}})).toBe(3);
});
it("admits simultaneous registrations with the same name and different emails",async()=>{
 const name=`Race ${run}`;
 const results=await Promise.allSettled([account("race-a",name),account("race-b",name)]);
 const failed=results.find(result=>result.status==="rejected");if(failed?.status==="rejected")throw failed.reason;
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(2);
 expect(await prisma.user.count({where:{name,deletedAt:null}})).toBe(2);
});
it("allows matching profile names while enforcing account ownership",async()=>{
 const first=await account("first",`Profile ${run}`),second=await account("second",`Other ${run}`);
 await asUser(second.id,()=>updateProfile(second.id,{name:first.name}));
 expect(await prisma.user.count({where:{name:first.name,deletedAt:null}})).toBe(2);
 await asUser(first.id,()=>updateProfile(first.id,{name:first.name}));
 await asUser(second.id,()=>updateProfile(second.id,{name:first.name.toLowerCase()}));
 await expect(asUser(second.id,()=>updateProfile(first.id,{name:`Foreign ${run}`}))).rejects.toMatchObject({httpStatus:403});
});
it("erases the deleted account's name and nickname, then immediately allows name reuse",async()=>{
 const first=await account("old",`Released ${run}`);await prisma.user.update({where:{id:first.id},data:{nickname:"Private nickname"}});
 await asUser(first.id,()=>deleteAccount(first.id));
 expect(await prisma.user.findUnique({where:{id:first.id},select:{name:true,nickname:true,deletedAt:true}})).toMatchObject({name:"Deleted account",nickname:null,deletedAt:expect.any(Date)});
 await account("replacement",first.name);
});
it("keeps a new OAuth user's display name even when another account has it",async()=>{
 const first=await account("existing",`OAuth ${run}`);
 const profile={provider:"GOOGLE" as const,providerAccountId:run,email:email("oauth"),name:first.name};
 const oauth=await upsertUserFromOAuthProfile(profile);
 expect(oauth.name).toBe(first.name);expect(oauth.id).not.toBe(first.id);
 expect((await upsertUserFromOAuthProfile(profile)).id).toBe(oauth.id);
 expect((await prisma.user.findUniqueOrThrow({where:{id:first.id}})).name).toBe(first.name);
});
