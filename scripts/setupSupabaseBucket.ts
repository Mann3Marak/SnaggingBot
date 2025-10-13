import { getSupabase } from "@/lib/supabase";

async function ensureInspectionPhotosBucket() {
  const supabase = getSupabase();

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets?.some((b) => b.name === "inspection-photos");
    if (exists) {
      console.log("✅ Supabase bucket 'inspection-photos' already exists.");
      return;
    }

    const { error: createError } = await supabase.storage.createBucket("inspection-photos", {
      public: true,
    });
    if (createError) throw createError;

    console.log("✅ Created Supabase bucket 'inspection-photos' successfully.");
  } catch (err) {
    console.error("❌ Failed to ensure Supabase bucket:", err);
  }
}

ensureInspectionPhotosBucket();
