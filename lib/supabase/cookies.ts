// No browser Supabase client exists, so session cookies never need to be readable by JS.
export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;
