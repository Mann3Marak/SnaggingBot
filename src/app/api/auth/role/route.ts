import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireApiAuth, validateUUID } from "@/lib/server/apiAuth";

export async function GET(req: NextRequest) {
  try {
    const { user, profile } = await requireApiAuth(req);
    const supabase = createServiceClient({
      userId: user.id,
      route: req.nextUrl.pathname,
    });

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }
    validateUUID(userId, "user ID");

    // Users can only request their own profile unless they are admin.
    if (profile.role !== "admin" && userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("users")
      .select("id, email, role, full_name")
      .eq("id", userId);

    if (error) {
      console.error("Error fetching user role:", error);
      return NextResponse.json({ error: "Failed to fetch user role" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ user: null, message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: data[0] });
  } catch (err: any) {
    if (err instanceof NextResponse) {
      return err;
    }
    console.error("Unexpected error fetching user role:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
