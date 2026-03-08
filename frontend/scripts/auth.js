import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://zlohxksdrfxctqhkldoa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpsb2h4a3NkcmZ4Y3RxaGtsZG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTI1MjUsImV4cCI6MjA4ODUyODUyNX0.MewerVWJpL06e8MAmx69USkhxIQqCj-OoQ-Y3xolUmk'; // From .env.template

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

/**
 * Upload an avatar to Supabase Storage
 * @param {File} file 
 * @param {string} userId 
 */
export async function uploadAvatar(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

    if (error) return { error };

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

    return { publicUrl, error: null };
}

/**
 * Sign up a new user
 * @param {string} email 
 * @param {string} password 
 * @param {object} metaData 
 */
export async function signUp(email, password, metaData) {
    const frontendUrl = window.location.origin; // Dynamically detect local or prod URL
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: metaData,
            emailRedirectTo: `${frontendUrl}/frontend/index.html`
        }
    });
    return { data, error };
}

/**
 * Sign in an existing user
 * @param {string} email 
 * @param {string} password 
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

/**
 * Sign out the current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

/**
 * Get the current user session
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Get the current user info
 */
export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Listen for auth state changes
 * @param {function} callback 
 */
export function onAuthChange(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}
