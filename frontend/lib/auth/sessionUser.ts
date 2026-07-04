import { cache } from "react";

import { prisma } from "@/lib/db";

function fetchUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      active: true,
    },
  });
}

// React.cache dedupes this per request (layout + requireRole share one query). It only
// exists in the RSC runtime, so fall back to the bare fetch when unavailable (e.g. tests).
export const getCurrentUserById =
  typeof cache === "function" ? cache(fetchUserById) : fetchUserById;
