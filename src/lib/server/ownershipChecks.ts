import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verifies that a session belongs to the specified user or user is admin
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param sessionId - Session ID to verify
 * @param userId - User ID to check ownership against
 * @param isAdmin - Whether the user has admin role
 * @returns true if user owns the session OR is admin
 */
export async function verifySessionOwnership(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  // Use RLS-enforced query - will only return session if user has access
  const { data: session, error } = await supabase
    .from("inspection_sessions")
    .select("inspector_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !session) {
    return false;
  }

  return session.inspector_id === userId || isAdmin;
}

/**
 * Verifies that a project belongs to the specified company
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param projectId - Project ID to verify
 * @param companyId - Company ID to check ownership against
 * @returns true if project belongs to company
 */
export async function verifyProjectOwnership(
  supabase: SupabaseClient,
  projectId: string,
  companyId: string
): Promise<boolean> {
  // Use RLS-enforced query
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, company_id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle();

  return !error && !!project;
}

/**
 * Verifies that an apartment belongs to a project owned by the specified company
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param apartmentId - Apartment ID to verify
 * @param companyId - Company ID to check ownership against
 * @returns true if apartment's project belongs to company
 */
export async function verifyApartmentOwnership(
  supabase: SupabaseClient,
  apartmentId: string,
  companyId: string
): Promise<boolean> {
  // Join with projects to check company ownership through RLS
  const { data: apartment, error } = await supabase
    .from("apartments")
    .select("id, project_id, projects!inner(company_id)")
    .eq("id", apartmentId)
    .maybeSingle();

  if (error || !apartment) {
    return false;
  }

  const projectCompanyId = (apartment.projects as any)?.company_id;
  return projectCompanyId === companyId;
}

/**
 * Verifies that an inspection result belongs to a session owned by the user
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param resultId - Result ID to verify
 * @param userId - User ID to check ownership against
 * @param isAdmin - Whether the user has admin role
 * @returns true if result's session belongs to user OR user is admin
 */
export async function verifyResultOwnership(
  supabase: SupabaseClient,
  resultId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  // Join with sessions to check inspector ownership through RLS
  const { data: result, error } = await supabase
    .from("inspection_results")
    .select("id, session_id, inspection_sessions!inner(inspector_id)")
    .eq("id", resultId)
    .maybeSingle();

  if (error || !result) {
    return false;
  }

  const inspectorId = (result.inspection_sessions as any)?.inspector_id;
  return inspectorId === userId || isAdmin;
}

/**
 * Gets the company ID for a project
 * Useful for verifying company isolation when creating resources
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param projectId - Project ID to look up
 * @returns Company ID if found, null otherwise
 */
export async function getProjectCompanyId(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("company_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    return null;
  }

  return project.company_id;
}

/**
 * Gets the company ID for an apartment (via its project)
 * Useful for verifying company isolation when creating inspection sessions
 *
 * @param supabase - Authenticated Supabase client (respects RLS)
 * @param apartmentId - Apartment ID to look up
 * @returns Company ID if found, null otherwise
 */
export async function getApartmentCompanyId(
  supabase: SupabaseClient,
  apartmentId: string
): Promise<string | null> {
  const { data: apartment, error } = await supabase
    .from("apartments")
    .select("project_id, projects!inner(company_id)")
    .eq("id", apartmentId)
    .maybeSingle();

  if (error || !apartment) {
    return null;
  }

  return (apartment.projects as any)?.company_id || null;
}
