"use client";

import {createClient} from "@supabase/supabase-js";
import {Database} from "../types/database.types";


const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseKey || !supabaseUrl) {
    throw new Error("Missing Supabase environment variables");
}

export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseKey ,{
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

export type Tables = Database['public']['Tables'];