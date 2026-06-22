import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import type { BlackbaudConstituent } from "@/types";
import { users, communicationPreferences } from "../db/schema";

const VALID_TYPES = [
  "individual",
  "major_donor",
  "church",
  "foundation",
  "daf",
  "ambassador",
  "volunteer",
] as const;
type ConstituentType = (typeof VALID_TYPES)[number];

function normalizeType(value: unknown): ConstituentType {
  if (typeof value !== "string") return "individual";
  const n = value.toLowerCase().replace(/\s+/g, "_");
  return (VALID_TYPES as readonly string[]).includes(n) ? (n as ConstituentType) : "individual";
}

function fallbackName(email: string): { firstName: string; lastName: string } {
  const [local] = email.split("@");
  const tokens = (local ?? "")
    .split(/[.\-_]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
  if (tokens.length === 0) return { firstName: "Portal", lastName: "User" };
  if (tokens.length === 1) return { firstName: tokens[0], lastName: "User" };
  return { firstName: tokens[0], lastName: tokens.slice(1).join(" ") };
}

export type ProvisionOpts = { constituent?: BlackbaudConstituent | null; allowDevCreate?: boolean };

// Find a portal user by email, or provision one (from SKY constituent, or a dev
// fallback). Returns null if no user exists and creation is not permitted.
export async function findOrProvisionUser(db: Db, email: string, opts: ProvisionOpts = {}) {
  const normalized = email.toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, normalized)).get();
  if (existing) return existing;

  const constituent = opts.constituent ?? null;
  if (!constituent && !opts.allowDevCreate) return null;

  const fb = fallbackName(normalized);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(users).values({
    id,
    email: normalized,
    firstName: constituent?.firstName?.trim() || fb.firstName,
    lastName: constituent?.lastName?.trim() || fb.lastName,
    phone: constituent?.phone ?? null,
    blackbaudConstituentId: constituent?.id ?? null,
    constituentType: normalizeType(constituent?.constituentCode),
    lifetimeGivingTotal: Number(constituent?.lifetimeGiving ?? 0),
    rddAssignment: constituent?.rddAssignment ?? null,
    onboardingRequired: !constituent,
    onboardingCompletedAt: constituent ? now : null,
    createdAt: now,
  });

  await db.insert(communicationPreferences).values({
    userId: id,
    reportPeriod: "quarterly",
    blackbaudSolicitCodes: constituent?.solicitCodes ?? [],
    updatedAt: now,
  });

  return db.select().from(users).where(eq(users.id, id)).get();
}
