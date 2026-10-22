import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth.jsx";

const ProfileContext = createContext(null);

const LEVELS = [
  { level: 1, title: "Novice", minXp: 0, maxXp: 199 },
  { level: 2, title: "Apprentice", minXp: 200, maxXp: 499 },
  { level: 3, title: "Practitioner", minXp: 500, maxXp: 999 },
  { level: 4, title: "Engineer", minXp: 1000, maxXp: 1999 },
  { level: 5, title: "Architect", minXp: 2000, maxXp: Infinity },
];

export function getLevelMeta(xp = 0) {
  return LEVELS.find((entry) => xp >= entry.minXp && xp <= entry.maxXp) || LEVELS[0];
}

function makeFallbackUsername(user) {
  const candidates = [
    user?.user_metadata?.username,
    user?.user_metadata?.full_name,
    user?.user_metadata?.name,
    user?.email?.split("@")[0],
    "algonaut",
  ];
  const source = candidates.find(Boolean) || "algonaut";
  return source.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "algonaut";
}

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshId = useRef(0);
  const mounted = useRef(true);
  const currentUser = useRef(user?.id);
  useLayoutEffect(() => {
    currentUser.current = user?.id;
    mounted.current = true;
    const generation = refreshId;
    return () => { mounted.current = false; generation.current++; };
  }, [user?.id]);

  async function ensureProfile(userRecord) {
    if (!userRecord?.id) {
      return null;
    }

    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userRecord.id)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existing) {
      return existing;
    }

    const payload = {
      id: userRecord.id,
      username: makeFallbackUsername(userRecord),
    };

    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();

    if (createError) {
      throw createError;
    }

    return created;
  }

  async function refreshProfile({ isCurrent = () => true } = {}) {
    const id = ++refreshId.current;
    const owner = user?.id;
    const active = () => mounted.current && currentUser.current === owner && refreshId.current === id;
    const mayCommit = () => active() && isCurrent();
    if (!owner) {
      if (mayCommit()) { setProfile(null); setLoading(false); }
      return null;
    }
    if (!mayCommit()) return null;
    setLoading(true);
    setError("");
    try {
      const nextProfile = await ensureProfile(user);
      if (!mayCommit()) return null;
      const { data: rewards, error: rewardError } = await supabase
        .from("reward_accounts").select("*").eq("user_id", owner).maybeSingle();
      if (rewardError) throw rewardError;
      if (!mayCommit()) return null;
      // Legacy profile balances are unverified; never import them as rewards.
      const authoritative = { ...nextProfile, xp: rewards?.xp || 0, level: rewards?.level || 1,
        streak: rewards?.streak || 0, last_active_date: rewards?.last_active_date || null };
      setProfile(authoritative);
      return authoritative;
    } catch (profileError) {
      if (mayCommit()) setError(profileError.message || "Unable to load profile.");
      return null;
    } finally {
      if (active()) setLoading(false);
    }
  }

  async function updateProfile(patch) {
    if (!user?.id) {
      return null;
    }

    if (Object.keys(patch).some((key) => key !== "username")) throw new Error("Only username is editable.");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ username: patch.username })
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    return refreshProfile();
  }

  useEffect(() => {
    refreshProfile(); // refreshProfile handles failure and stale responses internally.
  }, [user?.id]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        error,
        refreshProfile,
        updateProfile,
        levelMeta: getLevelMeta(profile?.xp || 0),
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider.");
  }
  return context;
}
