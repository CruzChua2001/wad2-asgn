import { createBrowserClient } from "@supabase/ssr";

export const createClient = _ => {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
}