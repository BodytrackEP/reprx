import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Target of the invite email (supabase/templates/invite.html).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "invite",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL("/accept-invite", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
