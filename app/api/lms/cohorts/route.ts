import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import {
  listCohorts,
  createCohort,
  listCohortMembers,
  upsertCohortMembership,
  leaveCohort,
} from "@/lib/db/access/community";
import { writeAuditLog } from "@/lib/db/access/activity";
import { AuthorizationError } from "@/lib/db/access/authz";

export const runtime = "nodejs";

interface CohortMutationBody {
  action?: "create" | "join" | "leave";
  courseId?: string;
  cohortId?: string;
  name?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
}

export async function GET(request: Request) {
  try {
    const courseId = new URL(request.url).searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    const cohortRows = (await listCohorts(db, ctx, courseId))
      .filter((row) => row.isActive)
      .sort((a, b) => {
        const aStarts = a.startsAt ?? "";
        const bStarts = b.startsAt ?? "";
        if (aStarts !== bStarts) return bStarts.localeCompare(aStarts);
        const aCreated = a.createdAt ?? "";
        const bCreated = b.createdAt ?? "";
        return bCreated.localeCompare(aCreated);
      });

    const cohortIds = cohortRows.map((row) => row.id);
    const memberRows = await listCohortMembers(db, ctx, cohortIds);

    const membersByCohort = new Map<string, number>();
    const membershipByCohort = new Map<string, string>();
    for (const row of memberRows) {
      membersByCohort.set(row.cohortId, (membersByCohort.get(row.cohortId) ?? 0) + 1);
      if (row.userId === ctx.userId) {
        membershipByCohort.set(row.cohortId, row.membershipRole);
      }
    }

    return NextResponse.json(
      {
        success: true,
        cohorts: cohortRows.map((row) => ({
          id: row.id,
          courseId: row.courseId,
          name: row.name,
          description: row.description,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          isActive: row.isActive,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          membersCount: membersByCohort.get(row.id) ?? 0,
          isMember: membershipByCohort.has(row.id),
          membershipRole: membershipByCohort.get(row.id) ?? null,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("LMS cohorts GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CohortMutationBody;
    if (!body.action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const db = getDb();

    if (body.action === "create") {
      if (!body.courseId || !body.name?.trim()) {
        return NextResponse.json({ error: "Missing courseId or name" }, { status: 400 });
      }

      let created;
      try {
        created = await createCohort(db, ctx, {
          courseId: body.courseId,
          name: body.name.trim(),
          description: body.description?.trim() || null,
          startsAt: body.startsAt || null,
          endsAt: body.endsAt || null,
        });
      } catch (error) {
        if (error instanceof AuthorizationError) {
          return NextResponse.json({ error: "Insufficient permission" }, { status: 403 });
        }
        throw error;
      }

      await upsertCohortMembership(db, ctx, created.id, "instructor");

      try {
        await writeAuditLog(db, ctx, {
          action: "lms.cohort.create",
          entityType: "cohort",
          entityId: created.id,
          details: {
            courseId: body.courseId,
            name: body.name.trim(),
          },
        });
      } catch {
        // audit logging is best-effort; never fail the request on audit error.
      }

      return NextResponse.json(
        {
          success: true,
          cohort: {
            id: created.id,
            courseId: created.courseId,
            name: created.name,
            description: created.description,
            startsAt: created.startsAt,
            endsAt: created.endsAt,
            isActive: created.isActive,
            createdBy: created.createdBy,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            membersCount: 1,
            isMember: true,
            membershipRole: "instructor",
          },
        },
        { status: 200 }
      );
    }

    if (!body.cohortId) {
      return NextResponse.json({ error: "Missing cohortId" }, { status: 400 });
    }

    if (body.action === "join") {
      await upsertCohortMembership(db, ctx, body.cohortId, "learner");
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (body.action === "leave") {
      await leaveCohort(db, ctx, body.cohortId);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("LMS cohorts POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
