import { supabase } from './supabase'

export async function signInWithMagicLink(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + '/auth/callback',
    },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user ?? null
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function updateProfile(userId, updates) {
  return supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
}

export async function deleteAccount() {
  return supabase.rpc('delete_user')
}
