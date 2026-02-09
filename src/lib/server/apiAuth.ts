import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

/**
 * User profile data from the database
 */
export interface UserProfile {
  id: string;
  company_id: string | null;
  role: "admin" | "inspector" | "manager";
  full_name: string | null;
  email: string;
}

/**
 * Authentication context returned by auth utilities
 */
export interface AuthContext {
  user: User;
  profile: UserProfile;
  supabase: SupabaseClient;
}

/**
 * Resource ownership check configuration
 */
export interface OwnershipCheck {
  type: "session" | "project" | "apartment" | "result";
  resourceId: string;
}

/**
 * Extracts authenticated user from request cookies
 * Returns authenticated Supabase client that respects RLS policies
 *
 * @param req - Next.js request object
 * @returns Auth context with user, profile, and authenticated Supabase client
 * @throws Response with 401 if authentication fails
 * @throws Response with 403 if user has no company assignment
 * @throws Response with 500 if profile lookup fails
 */
export async function requireApiAuth(req: NextRequest): Promise<AuthContext> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    logger.error("[ApiAuth] Missing Supabase credentials");
    throw NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Check for Bearer token in Authorization header (for API testing)
  const authHeader = req.headers.get('Authorization');
  let supabase: SupabaseClient;
  let user: User | null = null;
  let userError: any = null;

  logger.debug('[ApiAuth] Checking authentication method', {
    route: req.nextUrl.pathname,
    hasAuthHeader: !!authHeader,
  });

  if (authHeader?.startsWith('Bearer ')) {
    // API testing mode: Use Bearer token
    const token = authHeader.substring(7);
    logger.debug('[ApiAuth] Using Bearer token authentication', {
      route: req.nextUrl.pathname,
      tokenLength: token.length,
    });

    const tokenClient = createClient(supabaseUrl, anonKey);
    const { data, error } = await tokenClient.auth.getUser(token);
    user = data.user;
    userError = error;

    logger.debug('[ApiAuth] Bearer token validation result', {
      route: req.nextUrl.pathname,
      userId: user?.id || 'none',
      error: error?.message || 'none',
    });

    // Create authenticated client for this token
    supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  } else {
    // Browser mode: Use cookies (respects RLS)
    logger.debug('[ApiAuth] Using cookie-based authentication', {
      route: req.nextUrl.pathname,
    });

    const cookieStore = cookies();
    supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    });

    // Get authenticated user from cookies
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    userError = error;

    logger.debug('[ApiAuth] Cookie authentication result', {
      route: req.nextUrl.pathname,
      userId: user?.id || 'none',
      error: error?.message || 'none',
    });
  }

  if (userError) {
    logger.error("[ApiAuth] Failed to read auth user", {
      error: userError.message,
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  if (!user) {
    logger.warn("[ApiAuth] Unauthenticated request blocked", {
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Use service role to fetch user profile (bypasses RLS for profile lookup)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("users")
    .select("id, company_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    logger.error("[ApiAuth] Failed to load user profile", {
      error: profileError.message,
      userId: user.id,
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json(
      { error: "Unable to resolve user profile" },
      { status: 500 }
    );
  }

  if (!profile) {
    logger.error("[ApiAuth] User profile not found", {
      userId: user.id,
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json(
      { error: "User profile not found" },
      { status: 500 }
    );
  }

  if (!profile.company_id) {
    logger.error("[ApiAuth] User profile missing company assignment", {
      userId: user.id,
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json(
      {
        error:
          "Your user is not linked to a company. Ask an admin to update your profile.",
      },
      { status: 403 }
    );
  }

  logger.debug("[ApiAuth] Request authenticated", {
    userId: user.id,
    companyId: profile.company_id,
    role: profile.role,
    route: req.nextUrl.pathname,
  });

  return {
    user,
    profile: {
      id: profile.id,
      company_id: profile.company_id,
      role: profile.role as "admin" | "inspector" | "manager",
      full_name: profile.full_name,
      email: profile.email,
    },
    supabase,
  };
}

/**
 * Requires authentication and verifies resource ownership
 * User must own the resource OR be an admin
 *
 * @param req - Next.js request object
 * @param ownershipCheck - Resource ownership configuration
 * @returns Auth context if ownership check passes
 * @throws Response with 401 if not authenticated
 * @throws Response with 403 if ownership check fails
 * @throws Response with 404 if resource not found
 */
export async function requireOwnership(
  req: NextRequest,
  ownershipCheck: OwnershipCheck
): Promise<AuthContext> {
  const authContext = await requireApiAuth(req);
  const { user, profile, supabase } = authContext;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use service role for ownership lookup (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const isAdmin = profile.role === "admin";

  switch (ownershipCheck.type) {
    case "session": {
      const { data: session, error } = await adminClient
        .from("inspection_sessions")
        .select("inspector_id")
        .eq("id", ownershipCheck.resourceId)
        .maybeSingle();

      if (error) {
        logger.error("[ApiAuth] Session ownership check failed", {
          error: error.message,
          sessionId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json(
          { error: "Session lookup failed" },
          { status: 500 }
        );
      }

      if (!session) {
        logger.warn("[ApiAuth] Session not found", {
          sessionId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const isOwner = session.inspector_id === user.id;

      if (!isOwner && !isAdmin) {
        logger.warn("[ApiAuth] Session access denied", {
          sessionId: ownershipCheck.resourceId,
          requester: user.id,
          owner: session.inspector_id,
          isAdmin,
        });
        throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      logger.debug("[ApiAuth] Session access granted", {
        sessionId: ownershipCheck.resourceId,
        userId: user.id,
        isOwner,
        isAdmin,
      });
      break;
    }

    case "project": {
      const { data: project, error } = await adminClient
        .from("projects")
        .select("company_id")
        .eq("id", ownershipCheck.resourceId)
        .maybeSingle();

      if (error) {
        logger.error("[ApiAuth] Project ownership check failed", {
          error: error.message,
          projectId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json(
          { error: "Project lookup failed" },
          { status: 500 }
        );
      }

      if (!project) {
        logger.warn("[ApiAuth] Project not found", {
          projectId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const belongsToCompany = project.company_id === profile.company_id;

      if (!belongsToCompany && !isAdmin) {
        logger.warn("[ApiAuth] Project access denied", {
          projectId: ownershipCheck.resourceId,
          requester: user.id,
          userCompany: profile.company_id,
          projectCompany: project.company_id,
        });
        throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      logger.debug("[ApiAuth] Project access granted", {
        projectId: ownershipCheck.resourceId,
        userId: user.id,
        belongsToCompany,
        isAdmin,
      });
      break;
    }

    case "apartment": {
      const { data: apartment, error } = await adminClient
        .from("apartments")
        .select("project_id, projects!inner(company_id)")
        .eq("id", ownershipCheck.resourceId)
        .maybeSingle();

      if (error) {
        logger.error("[ApiAuth] Apartment ownership check failed", {
          error: error.message,
          apartmentId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json(
          { error: "Apartment lookup failed" },
          { status: 500 }
        );
      }

      if (!apartment) {
        logger.warn("[ApiAuth] Apartment not found", {
          apartmentId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const projectCompanyId = (apartment.projects as any)?.company_id;
      const belongsToCompany = projectCompanyId === profile.company_id;

      if (!belongsToCompany && !isAdmin) {
        logger.warn("[ApiAuth] Apartment access denied", {
          apartmentId: ownershipCheck.resourceId,
          requester: user.id,
          userCompany: profile.company_id,
          projectCompany: projectCompanyId,
        });
        throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      logger.debug("[ApiAuth] Apartment access granted", {
        apartmentId: ownershipCheck.resourceId,
        userId: user.id,
        belongsToCompany,
        isAdmin,
      });
      break;
    }

    case "result": {
      const { data: result, error } = await adminClient
        .from("inspection_results")
        .select("session_id, inspection_sessions!inner(inspector_id)")
        .eq("id", ownershipCheck.resourceId)
        .maybeSingle();

      if (error) {
        logger.error("[ApiAuth] Result ownership check failed", {
          error: error.message,
          resultId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json(
          { error: "Result lookup failed" },
          { status: 500 }
        );
      }

      if (!result) {
        logger.warn("[ApiAuth] Result not found", {
          resultId: ownershipCheck.resourceId,
          userId: user.id,
        });
        throw NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const inspectorId = (result.inspection_sessions as any)?.inspector_id;
      const isOwner = inspectorId === user.id;

      if (!isOwner && !isAdmin) {
        logger.warn("[ApiAuth] Result access denied", {
          resultId: ownershipCheck.resourceId,
          requester: user.id,
          owner: inspectorId,
        });
        throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      logger.debug("[ApiAuth] Result access granted", {
        resultId: ownershipCheck.resourceId,
        userId: user.id,
        isOwner,
        isAdmin,
      });
      break;
    }

    default:
      throw NextResponse.json(
        { error: "Invalid ownership check type" },
        { status: 500 }
      );
  }

  return authContext;
}

/**
 * Requires authentication and verifies user has one of the allowed roles
 *
 * @param req - Next.js request object
 * @param allowedRoles - Array of roles that can access this endpoint
 * @returns Auth context if role check passes
 * @throws Response with 401 if not authenticated
 * @throws Response with 403 if role check fails
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: Array<"admin" | "inspector" | "manager">
): Promise<AuthContext> {
  const authContext = await requireApiAuth(req);
  const { user, profile } = authContext;

  if (!allowedRoles.includes(profile.role)) {
    logger.warn("[ApiAuth] Role check failed", {
      userId: user.id,
      userRole: profile.role,
      allowedRoles,
      route: req.nextUrl.pathname,
    });
    throw NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  logger.debug("[ApiAuth] Role check passed", {
    userId: user.id,
    userRole: profile.role,
    route: req.nextUrl.pathname,
  });

  return authContext;
}

/**
 * Validates that a string is a valid UUID (any version)
 * Returns 400 Bad Request if invalid
 *
 * @param value - String to validate as UUID
 * @param fieldName - Name of the field for error message
 * @throws Response with 400 if not a valid UUID
 */
export function validateUUID(value: string, fieldName: string = "ID"): void {
  // Accept any valid UUID format (not just v4)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    logger.warn("[ApiAuth] Invalid UUID format", {
      value,
      fieldName,
    });
    throw NextResponse.json(
      { error: `Invalid ${fieldName} format` },
      { status: 400 }
    );
  }
}

/**
 * Creates a service role client with logging
 * Should only be used after authentication
 *
 * @param context - Context for logging service role usage
 * @returns Supabase client with service role (bypasses RLS)
 */
export function createServiceClient(context: {
  userId: string;
  route: string;
}): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  logger.debug("[ServiceRole] Usage", {
    timestamp: new Date().toISOString(),
    userId: context.userId,
    route: context.route,
  });

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
