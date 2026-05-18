import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function createProfile(user, displayName, email) {
  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  await supabase.from('profiles').insert({
    id: user.id,
    username,
    display_name: displayName || username,
    email,
  });
  const { data: achievements } = await supabase.from('achievements').select('id');
  if (achievements?.length) {
    await supabase.from('user_achievements').insert(
      achievements.map(a => ({ user_id: user.id, achievement_id: a.id, unlocked: false }))
    );
  }
}

export async function loadUserProgress(userId) {
  const [{ data: progress }, { data: earned }, { data: profile }] = await Promise.all([
    supabase.from('user_module_progress').select('module_id, stars').eq('user_id', userId),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId).eq('unlocked', true),
    supabase.from('profiles').select('session_count').eq('id', userId).single(),
  ]);

  const completedModules = {};
  (progress ?? []).forEach(row => { completedModules[row.module_id] = { stars: row.stars }; });

  return {
    completedModules,
    earnedIds: new Set((earned ?? []).map(r => r.achievement_id)),
    sessionCount: profile?.session_count ?? 0,
  };
}

export async function saveModuleProgress(userId, moduleId, stars, sessionCount) {
  await Promise.all([
    supabase.from('user_module_progress').upsert(
      { user_id: userId, module_id: moduleId, stars, completed_at: new Date().toISOString() },
      { onConflict: 'user_id,module_id' }
    ),
    supabase.from('profiles').update({ session_count: sessionCount }).eq('id', userId),
  ]);
}

export async function unlockAchievement(userId, achievementId) {
  await supabase.from('user_achievements').upsert(
    { user_id: userId, achievement_id: achievementId, unlocked: true, unlocked_at: new Date().toISOString() },
    { onConflict: 'user_id,achievement_id' }
  );
}
