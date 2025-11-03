import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Universal dummy function to stop all Supabase webhook retries
// This function returns 200 OK for any incoming request, clearing all retry queues
serve(() => {
  console.log("🧹 stop-retries function called — returning 200 OK");
  return new Response("OK", { status: 200 });
});
