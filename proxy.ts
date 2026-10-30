import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { isSessionExpired } from "@/lib/session";
import { authCookieOptions } from "@/lib/supabase/cookies";

const PUBLIC_PATHS = ["/login", "/auth/confirm"];

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next's dev overlay injects inline styles; a nonce here would disable 'unsafe-inline'.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Also refreshes an expiring session, so this must run on every request.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!claims) {
    if (!isPublic) return redirectTo("/login");
  } else if (pathname === "/" || pathname === "/login") {
    return redirectTo(claims.aal === "aal2" ? "/admin" : "/mfa");
  } else if (pathname.startsWith("/admin")) {
    if (claims.aal !== "aal2") return redirectTo("/mfa");

    const { data: settings } = await supabase
      .from("app_settings")
      .select("staff_session_timeout_hours")
      .maybeSingle();

    if (
      settings &&
      isSessionExpired(claims.amr, settings.staff_session_timeout_hours, Date.now())
    ) {
      await supabase.auth.signOut();
      return redirectTo("/login?reason=timeout");
    }
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // /api routes authenticate themselves (CRON_SECRET in Phase 2).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
