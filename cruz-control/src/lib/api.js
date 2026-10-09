import axios from "axios";
import { createClient } from "./client";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

// Attach the user token to the authorization header for every request
api.interceptors.request.use(async config => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    config.headers.Authorization = `Bearer ${data.session?.access_token}`;
    return config
})

export default api;