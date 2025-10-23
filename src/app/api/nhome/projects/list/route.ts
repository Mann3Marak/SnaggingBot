import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("🔍 Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    // Check which schema and table Supabase is reading from
    const { data: schemaList, error: schemaError } = await supabase
      .from("information_schema.tables")
      .select("table_schema, table_name")
      .eq("table_name", "projects");

    if (schemaError) {
      console.error("Error fetching schema list:", schemaError);
    } else {
      console.log("🏗️ Schemas containing 'projects' table:", schemaList);
    }

    // Check if 'projects' is a view
    const { data: viewCheck, error: viewError } = await supabase
      .from("pg_views")
      .select("schemaname, viewname")
      .eq("viewname", "projects");

    if (viewError) {
      console.warn("⚠️ View check failed:", viewError.message);
    } else {
      console.log("🔎 Views named 'projects':", viewCheck);
    }

    // Try querying explicitly from public.projects
    const { data: publicData, error: publicError } = await supabase
      .from("public.projects")
      .select("id, name, apartment_types, building_numbers, created_at")
      .order("created_at", { ascending: false });

    if (publicError) {
      console.warn("⚠️ public.projects query failed:", publicError.message);
    } else {
      console.log("📦 public.projects rows:", publicData?.length || 0);
    }

    // Try querying explicitly from nhome.projects
    const { data: nhomeData, error: nhomeError } = await supabase
      .from("nhome.projects")
      .select("id, name, apartment_types, building_numbers, created_at")
      .order("created_at", { ascending: false });

    if (nhomeError) {
      console.warn("⚠️ nhome.projects query failed:", nhomeError.message);
    } else {
      console.log("📦 nhome.projects rows:", nhomeData?.length || 0);
    }

    // Default query (whatever Supabase resolves automatically)
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, apartment_types, building_numbers, created_at")
      .order("created_at", { ascending: false });
    console.log("📦 Default projects fetched:", data?.length || 0);
    console.log("🧩 Raw Supabase data:", JSON.stringify(data, null, 2));

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Normalize array fields in case Supabase returns them as strings
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
    console.error("Unexpected error fetching projects:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
