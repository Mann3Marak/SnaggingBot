import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createServiceClient, requireApiAuth } from "@/lib/server/apiAuth";

export async function GET(req: NextRequest) {
  try {
    const { user, profile } = await requireApiAuth(req);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, developer_name, address")
      .eq("company_id", profile.company_id)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching projects:", error);
      return NextResponse.json(
        { error: "Failed to fetch projects", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ projects: data });
  } catch (err: any) {
    if (err instanceof NextResponse) {
      return err;
    }
    console.error("Unexpected error fetching projects:", err);
    return NextResponse.json(
      { error: "Unexpected server error", detail: err.message },
      { status: 500 }
    );
  }
}
