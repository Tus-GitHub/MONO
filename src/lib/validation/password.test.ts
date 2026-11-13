import { expect, it } from "vitest";
import { passwordSchema, changePasswordSchema } from "./password";
import { registerSchema, resetPasswordSchema } from "./auth";
import { passwordStrength } from "@/lib/auth/password-strength";

it("accepts six characters without making character-mix guidance compulsory",()=>{
 for(const password of ["abcdef","123456","Ab1!xy"])expect(passwordSchema.safeParse(password).success).toBe(true);
 expect(passwordSchema.safeParse("Ab1!x").success).toBe(false);
 expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
});
it("uses the same six-character rule for registration, reset and change, with confirmation required",()=>{
 const input={password:"abcdef",confirmPassword:"abcdef"};
 expect(registerSchema.safeParse({...input,name:"Alex",email:"alex@example.invalid"}).success).toBe(true);
 expect(resetPasswordSchema.safeParse({...input,token:"test-token"}).success).toBe(true);
 expect(changePasswordSchema.safeParse({...input,currentPassword:"existing"}).success).toBe(true);
 for(const schema of [registerSchema,resetPasswordSchema,changePasswordSchema])expect(schema.safeParse({...input,name:"Alex",email:"alex@example.invalid",token:"test",currentPassword:"existing",confirmPassword:"wrong"}).success).toBe(false);
});
it("scores length and letter case, numbers and symbols without labelling short passwords strong",()=>{
 expect(passwordStrength("").level).toBe(0);
 expect(passwordStrength("abcde").label).toBe("Weak");
 expect(passwordStrength("abcdef").label).toBe("Weak");
 expect(passwordStrength("Ab1!xy").label).toBe("Fair");
 expect(passwordStrength("Ab1!xyZa").label).toBe("Good");
 expect(passwordStrength("Ab1!xyZaLonger").label).toBe("Strong");
 expect(passwordStrength("aaaaaaaaaaaaaaaa").label).toBe("Weak");
 expect(passwordStrength("Ab1!xy").checks.every(c=>c.met)).toBe(true);
 expect(passwordStrength("aBc123 ").checks[4].met).toBe(false);
});
