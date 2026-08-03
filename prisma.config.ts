import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Keeping config in source control avoids hidden local CLI behavior and gives
  // later teammates one place to extend migrations/generator settings.
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
