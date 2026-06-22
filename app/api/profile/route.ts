import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/api/route-auth";
import { getDb } from "@/lib/db/client";
import { getProfile, updateProfile } from "@/lib/db/access/profile";
import { recordActivity } from "@/lib/db/access/activity";
import { logError, logInfo } from "@/lib/logger";

export const runtime = "nodejs";

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredText(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  try {
    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;

    const profile = await getProfile(getDb(), ctx);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const details = profile.profileDetails;
    return NextResponse.json({
      success: true,
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone ?? "",
        street: details?.street ?? "",
        city: details?.city ?? "",
        state: details?.state ?? "",
        zip: details?.zip ?? "",
      },
    });
  } catch (error) {
    logError({ event: "profile.fetch_failed", route: "/api/profile", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const firstName = normalizeRequiredText(body?.firstName);
    const lastName = normalizeRequiredText(body?.lastName);
    const email = normalizeOptionalText(body?.email);
    const phone = normalizeOptionalText(body?.phone);
    const street = normalizeOptionalText(body?.street);
    const city = normalizeOptionalText(body?.city);
    const state = normalizeOptionalText(body?.state);
    const zip = normalizeOptionalText(body?.zip);

    if (firstName === null || lastName === null) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    const auth = await authedRoute();
    if ("error" in auth) return auth.error;
    const { ctx } = auth;
    const db = getDb();

    const current = await getProfile(db, ctx);
    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (email && email.toLowerCase() !== current.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Email updates must be handled through authentication settings." },
        { status: 400 }
      );
    }

    const userUpdates = {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
    };

    const detailUpdates = {
      ...(street !== undefined ? { street } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(state !== undefined ? { state } : {}),
      ...(zip !== undefined ? { zip } : {}),
    };

    const refreshed = await updateProfile(db, ctx, { ...userUpdates, ...detailUpdates });
    if (!refreshed) {
      return NextResponse.json({ error: "Profile refresh failed" }, { status: 500 });
    }

    await recordActivity(db, ctx, {
      type: "profile_updated",
      metadata: {
        fields: Object.keys({ ...userUpdates, ...detailUpdates }),
      },
    });

    logInfo({
      event: "profile.updated",
      route: "/api/profile",
      userId: ctx.userId,
    });

    const refreshedDetails = refreshed.profileDetails;
    return NextResponse.json({
      success: true,
      profile: {
        firstName: refreshed.firstName,
        lastName: refreshed.lastName,
        email: refreshed.email,
        phone: refreshed.phone ?? "",
        street: refreshedDetails?.street ?? "",
        city: refreshedDetails?.city ?? "",
        state: refreshedDetails?.state ?? "",
        zip: refreshedDetails?.zip ?? "",
      },
    });
  } catch (error) {
    logError({ event: "profile.update_failed", route: "/api/profile", error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
