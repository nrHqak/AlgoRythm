import { createContext, useContext, useEffect, useState } from "react";

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
      xp: 0,
      level: 1,
      streak: 0,
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

  async function refreshProfile() {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError("");

    try {
      const nextProfile = await ensureProfile(user);
      const levelMeta = getLevelMeta(nextProfile?.xp || 0);
      if (nextProfile && nextProfile.level !== levelMeta.level) {
        const { data: syncedProfile } = await supabase
          .from("profiles")
          .update({ level: levelMeta.level })
          .eq("id", user.id)
          .select("*")
          .single();
        setProfile(syncedProfile || { ...nextProfile, level: levelMeta.level });
        return syncedProfile || { ...nextProfile, level: levelMeta.level };
      }
      setProfile(nextProfile);
      return nextProfile;
    } catch (profileError) {
      setError(profileError.message || "Unable to load profile.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(patch) {
    if (!user?.id) {
      return null;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .single();

    if (updateError) {
      throw updateError;
    }

    setProfile(data);
    return data;
  }

  useEffect(() => {
    refreshProfile();
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
