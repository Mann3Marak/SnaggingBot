import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/server/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const body = await req.json();

    const supabase = getSupabaseServer();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error("[NHomeProjects] Failed to read auth user", userError);
      return NextResponse.json({ error: "Unable to read authenticated user" }, { status: 401 });
    }

    if (!user) {
      console.warn("[NHomeProjects] Anonymous request blocked");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("company_id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[NHomeProjects] Failed to load user profile", profileError);
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
    }

    if (!profile?.company_id) {
      console.error("[NHomeProjects] User profile missing company assignment", {
        userId: user.id,
        email: user.email,
      });
      return NextResponse.json(
        { error: "Your user is not linked to a company. Ask an admin to update your profile." },
        { status: 403 },
      );
    }

    const payload = {
      name: body.name,
      developer_name: body.developer_name,
      developer_contact_email: body.developer_contact_email || null,
      developer_contact_phone: body.developer_contact_phone || null,
      address: body.address,
      apartment_types: body.apartment_types || [],
      building_numbers: body.building_numbers || [],
      created_by: user.id,
      company_id: profile.company_id,
    };

    const { data, error } = await adminClient
      .from("projects")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[NHomeProjects] Error inserting project", { error, userId: user.id, payload });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.info("[NHomeProjects] Project created", {
      projectId: data?.id,
      userId: user.id,
      companyId: profile.company_id,
    });

    return NextResponse.json({ project: data }, { status: 200 });
  } catch (err: any) {
    console.error("[NHomeProjects] Unexpected error creating project", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
