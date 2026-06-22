import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import type { AuthContext } from "../auth-context";
import { userGivingGoals } from "../schema";
import { AuthorizationError } from "./authz";

export type NewGivingGoal = {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline: string;
  category: "annual" | "project" | "monthly" | "custom";
  description?: string;
};

export type UpdateGivingGoal = {
  name?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string;
  category?: "annual" | "project" | "monthly" | "custom";
  description?: string | null;
};

export async function listGivingGoals(db: Db, ctx: AuthContext) {
  return db.select().from(userGivingGoals).where(eq(userGivingGoals.userId, ctx.userId)).all();
}

export async function createGivingGoal(db: Db, ctx: AuthContext, input: NewGivingGoal) {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    userId: ctx.userId,
    name: input.name,
    targetAmount: input.targetAmount,
    currentAmount: input.currentAmount ?? 0,
    deadline: input.deadline,
    category: input.category,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(userGivingGoals).values(row);
  return row;
}

export async function updateGivingGoal(db: Db, ctx: AuthContext, id: string, input: UpdateGivingGoal) {
  const existing = await db.select().from(userGivingGoals).where(eq(userGivingGoals.id, id)).get();
  if (!existing) return null;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  const updated = {
    ...existing,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
    ...(input.currentAmount !== undefined ? { currentAmount: input.currentAmount } : {}),
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    updatedAt: new Date().toISOString(),
  };
  await db
    .update(userGivingGoals)
    .set(updated)
    .where(and(eq(userGivingGoals.id, id), eq(userGivingGoals.userId, ctx.userId)));
  return updated;
}

export async function deleteGivingGoal(db: Db, ctx: AuthContext, id: string) {
  const existing = await db.select().from(userGivingGoals).where(eq(userGivingGoals.id, id)).get();
  if (!existing) return;
  if (existing.userId !== ctx.userId) throw new AuthorizationError();
  await db.delete(userGivingGoals).where(and(eq(userGivingGoals.id, id), eq(userGivingGoals.userId, ctx.userId)));
}
