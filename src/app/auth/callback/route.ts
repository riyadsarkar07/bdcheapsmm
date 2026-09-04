import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerLoginSecurity } from "@/lib/session-security";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const userId = data.session?.user?.id;
      if (userId) {
        await registerLoginSecurity({
          userId,
          accessToken: data.session?.access_token,
          headers: request.headers,
          logLogin: "existing",
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
