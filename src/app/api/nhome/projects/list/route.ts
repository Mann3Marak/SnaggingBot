import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const cookieStore = cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError) {
      console.error("[NHomeProjectsList] Failed to read auth user", userError);
      return NextResponse.json({ error: "Unable to read authenticated user" }, { status: 401 });
    }

    if (!user) {
      console.warn("[NHomeProjectsList] Anonymous request blocked");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("company_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[NHomeProjectsList] Failed to load user profile", profileError);
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
    }

    if (!profile?.company_id) {
      console.error("[NHomeProjectsList] User missing company assignment", {
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json(
        { error: "Your user is not linked to a company. Ask an admin to update your profile." },
        { status: 403 },
      );
    }

    const { data, error } = await adminClient
      .from("projects")
      .select("id, name, apartment_types, building_numbers, created_at")
      .eq("company_id", profile.company_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[NHomeProjectsList] Error fetching projects", { error, userId: user.id });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.info("[NHomeProjectsList] Returning projects", {
      userId: user.id,
      companyId: profile.company_id,
      count: data?.length || 0,
    });

    const normalized = (data || []).map((p: any) => {
      const parseArray = (val: any) => {
        if (!val) return [];
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch {
            return [val];
          }
        }
        if (Array.isArray(val) && val.length === 1 && typeof val[0] === "string") {
          const inner = val[0].trim();
          if (inner.startsWith("[") || inner.startsWith("{")) {
            try {
              return JSON.parse(inner);
            } catch {
              return [inner];
            }
          }
        }
        return val;
      };

      return {
        ...p,
        apartment_types: parseArray(p.apartment_types),
        building_numbers: parseArray(p.building_numbers),
      };
    });

    return new NextResponse(JSON.stringify({ projects: normalized }), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    console.error("[NHomeProjectsList] Unexpected error fetching projects", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
