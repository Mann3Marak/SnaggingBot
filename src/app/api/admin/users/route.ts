import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/server/apiAuth";
import { logger } from "@/lib/logger";

type AllowedRole = "admin" | "manager" | "inspector";

interface CreateUserBody {
  fullName?: string;
  email?: string;
  role?: AllowedRole;
  password?: string;
}

const ALLOWED_ROLES = new Set<AllowedRole>(["admin", "manager", "inspector"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const { user, profile } = await requireRole(req, ["admin"]);

    const body = (await req.json()) as CreateUserBody;
    const fullName = (body.fullName || "").trim();
    const email = normalizeEmail(body.email || "");
    const role = body.role;
    const password = body.password || "";

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (!role || !ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: "Role must be admin, manager, or inspector" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!profile.company_id) {
      return NextResponse.json(
        { error: "Your user is not linked to a company. Ask an admin to update your profile." },
        { status: 403 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: existingUser, error: existingLookupError } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingLookupError) {
      logger.error("[Admin Users] Failed pre-check for existing user", {
        error: existingLookupError.message,
        adminUserId: user.id,
        email,
      });
      return NextResponse.json({ error: "Failed to validate existing users" }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    const { data: authCreateData, error: authCreateError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
        company_id: profile.company_id,
      },
    });

    if (authCreateError || !authCreateData?.user) {
      logger.error("[Admin Users] Failed to create auth user", {
        error: authCreateError?.message,
        adminUserId: user.id,
        email,
      });

      const msg = authCreateError?.message || "Failed to create auth user";
      const status = msg.toLowerCase().includes("already") ? 409 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const authUser = authCreateData.user;

    const { error: profileUpsertError } = await adminClient
      .from("users")
      .upsert(
        {
          id: authUser.id,
          email,
          full_name: fullName,
          role,
          company_id: profile.company_id,
        },
        { onConflict: "id" },
      );

    if (profileUpsertError) {
      logger.error("[Admin Users] Failed to upsert user profile after auth creation", {
        error: profileUpsertError.message,
        adminUserId: user.id,
        createdAuthUserId: authUser.id,
        email,
      });

      // Best-effort rollback so auth and public profiles don't drift.
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(authUser.id);
      if (rollbackError) {
        logger.error("[Admin Users] Rollback failed after profile upsert error", {
          error: rollbackError.message,
          adminUserId: user.id,
          createdAuthUserId: authUser.id,
        });
      }

      return NextResponse.json(
        { error: "Failed to create user profile. User creation was rolled back." },
        { status: 500 },
      );
    }

    logger.info("[Admin Users] User created", {
      adminUserId: user.id,
      createdUserId: authUser.id,
      companyId: profile.company_id,
      role,
      email,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: authUser.id,
          email,
          full_name: fullName,
          role,
          company_id: profile.company_id,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof NextResponse) {
      return error;
    }

    logger.error("[Admin Users] Unexpected error", { error: error?.message });
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
