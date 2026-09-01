/**
 * Next.js resolves these guard modules through its own compiler alias
 * (`next/dist/compiled/{server,client}-only`), so no package is installed. Declare them for
 * `tsc`, which does not see that alias.
 */
declare module "server-only";
declare module "client-only";
