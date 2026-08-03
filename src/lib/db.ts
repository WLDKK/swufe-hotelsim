// Keep this compatibility alias so any early files that imported `db` continue
// to work while later planned modules can standardize on `@/lib/prisma`.
export { prisma as db, prisma, default } from "@/lib/prisma";
