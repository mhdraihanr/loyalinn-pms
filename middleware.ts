import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public auth routes (accessible without login)
  const publicAuthRoutes = ["/login", "/signup", "/accept-invite"];
  const isPublicAuthRoute = publicAuthRoutes.some((r) =>
    pathname.startsWith(r),
  );

  // Protected routes that require login
  const protectedPrefixes = ["/guests", "/reservations", "/settings"];
  const isProtectedRoute =
    pathname === "/" || protectedPrefixes.some((p) => pathname.startsWith(p));

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protect onboarding routes — must be authenticated
  if (!user && pathname.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated users visiting login/signup
  // redirect to dashboard (tenant check handled in dashboard layout)
  if (user && isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Tenant membership check is handled in dashboard layout.
  // Avoid querying tenant_users here to prevent false negatives from RLS.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
