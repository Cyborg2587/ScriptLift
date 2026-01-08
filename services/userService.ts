import { supabase } from './supabaseClient';
import { User } from '../types';

/**
 * Ensures the user has a profile entry in the 'profiles' table.
 * This allows you to track who is using the app via your Supabase Dashboard.
 */
export const upsertProfile = async (user: User) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
    }, { onConflict: 'id' });

  if (error) throw error;
};