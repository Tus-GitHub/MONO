/** Public venue catalog fields and operational IDs/statuses/dates are intentionally searchable. */
export const privateTextFields: Record<string, readonly string[]> = {
  AudioUpload: ["name"], UserAudio: ["filename"], SiteAudio: ["title"],
  User: ["email", "name", "nickname", "pronouns"],
  AdminAccess: ["loginAlias"],
  Account: ["accessToken", "refreshToken", "idToken"],
  AuthSession: ["deviceLabel"],
  EmailVerificationToken: ["email"],
  CoupleInvitation: ["email"],
  Couple: ["name", "description"],
  Place: ["notes", "description"],
  Date: ["title", "notes", "actualLocationText", "actualNotes", "cancelReason"],
  DateActivity: ["title", "description"],
  DatePhoto: ["caption", "blurDataUrl"],
  ReviewCategory: ["label", "description"],
  DateReview: ["lovedText", "betterText", "rememberText", "unexpectedText", "personalRevisitNote"],
  DateReviewRating: ["note"],
  RevisitDecision: ["reason", "targetTimeframe"],
  Expense: ["description", "note"],
  Memory: ["title", "body"],
  Notification: ["title", "body"],
  DateEvent: ["summary"],
  ChatMessage: ["body"],
  AccountReport: ["details", "reviewNote"],
  ModerationAudit: ["reason"],
  EmailBlock: ["reason"],
};
export const privateJsonFields: Record<string, readonly string[]> = {
  Notification: ["data"], DateEvent: ["meta"], GameMatch: ["state"], CallSignal: ["payload"], GameChatSignal: ["payload"],
  PushSubscription: ["data"], NotificationPreference: ["pushSubscription"],
};
export const privateBytesFields: Record<string, readonly string[]> = { AudioUpload: ["bytes"], ChatImage: ["bytes"], UserAudio: ["ringtone"], SiteAudio: ["bytes"] };
export const identityLookupFields: Record<string, Record<string, string>> = {
  User: { email: "emailLookup", name: "nameLookup" },
  AdminAccess: { loginAlias: "aliasLookup" },
  EmailVerificationToken: { email: "emailLookup" },
};
export function lookupContext(model: string, field: string) {
  return field === "email" || field === "loginAlias" ? "identity:email" : `${model}.${field}`;
}
export function normalizeLookup(field: string, value: string) {
  return field === "email" || field === "loginAlias" ? value.trim().toLowerCase() : value.trim();
}
