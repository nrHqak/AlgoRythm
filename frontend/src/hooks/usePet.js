import { useEffect, useMemo, useState } from "react";

import { supabase } from "../lib/supabase";

const DEFAULT_PET = {
  pet_name: "Byte",
  hunger: 42,
  mood: 68,
  energy: 74,
  evolution_points: 0,
  last_fed_at: null,
};

const STAGES = [
  { min: 0, key: "seed", label: "Seed", emoji: "·:･ﾟ✧", aura: "is-seed" },
  { min: 120, key: "spark", label: "Spark", emoji: "(•◡•)", aura: "is-spark" },
  { min: 320, key: "sprite", label: "Sprite", emoji: "(ﾉ◕ヮ◕)ﾉ", aura: "is-sprite" },
  { min: 700, key: "guardian", label: "Guardian", emoji: "ʕ•ᴥ•ʔ", aura: "is-guardian" },
  { min: 1400, key: "legend", label: "Legend", emoji: "༼つ◕_◕༽つ", aura: "is-legend" },
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function startOfTodayIso() {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

function isSameDay(timestamp) {
  if (!timestamp) {
    return false;
  }
  return new Date(timestamp).toISOString().slice(0, 10) === startOfTodayIso();
}

function getStage(totalGrowth) {
  return [...STAGES].reverse().find((stage) => totalGrowth >= stage.min) || STAGES[0];
}

function derivePetView(pet, profileXp = 0) {
  const totalGrowth = (profileXp || 0) + (pet?.evolution_points || 0);
  const stage = getStage(totalGrowth);
  const canFeed = !isSameDay(pet?.last_fed_at);
  return {
    ...pet,
    totalGrowth,
    stage,
    canFeed,
  };
}

export function usePet(userId, profileXp = 0) {
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function ensurePetProfile() {
    if (!userId || !supabase) {
      setPet(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError("");

    const { data: existing, error: existingError } = await supabase
      .from("pet_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      setError(existingError.message || "Unable to load pet profile.");
      setLoading(false);
      return null;
    }

    if (existing) {
      setPet(existing);
      setLoading(false);
      return existing;
    }

    const { data: created, error: createError } = await supabase
      .from("pet_profiles")
      .insert({
        user_id: userId,
        ...DEFAULT_PET,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (createError) {
      setError(createError.message || "Unable to create pet profile.");
      setLoading(false);
      return null;
    }

    setPet(created);
    setLoading(false);
    return created;
  }

  async function refreshPet() {
    return ensurePetProfile();
  }

  async function patchPet(patch) {
    if (!userId || !supabase) {
      return null;
    }

    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from("pet_profiles")
      .update(payload)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message || "Unable to update pet.");
      return null;
    }

    setPet(data);
    return data;
  }

  async function feedPet() {
    if (!pet || !userId) {
      return { ok: false, alreadyFed: false };
    }

    if (isSameDay(pet.last_fed_at)) {
      return { ok: false, alreadyFed: true };
    }

    const nextPet = await patchPet({
      hunger: clamp((pet.hunger || 0) - 24),
      mood: clamp((pet.mood || 0) + 14),
      energy: clamp((pet.energy || 0) + 10),
      evolution_points: (pet.evolution_points || 0) + 8,
      last_fed_at: new Date().toISOString(),
    });

    return { ok: Boolean(nextPet), alreadyFed: false, pet: nextPet };
  }

  async function addPetProgress(points = 0, moodDelta = 0, energyDelta = 0) {
    if (!pet || !userId) {
      return null;
    }

    return patchPet({
      evolution_points: (pet.evolution_points || 0) + points,
      mood: clamp((pet.mood || 0) + moodDelta),
      energy: clamp((pet.energy || 0) + energyDelta),
      hunger: clamp((pet.hunger || 0) + Math.max(0, Math.floor(points / 8))),
    });
  }

  useEffect(() => {
    ensurePetProfile();
  }, [userId]);

  const petView = useMemo(() => {
    if (!pet) {
      return null;
    }
    return derivePetView(pet, profileXp);
  }, [pet, profileXp]);

  return {
    pet: petView,
    loading,
    error,
    refreshPet,
    feedPet,
    addPetProgress,
  };
}
