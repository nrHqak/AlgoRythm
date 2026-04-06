import { createContext, useContext, useEffect, useState } from "react";

import { supabase, supabaseConfigError } from "../lib/supabase";

const AuthContext = createContext(null);

function makeUsername(email, fallback = "algonaut") {
  const source = email?.split("@")[0] || fallback;
  return source.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24) || "algonaut";
}

async function insertProfileForUser(user, username) {
  if (!user?.id) {
    return;
  }

  const payload = {
    id: user.id,
    username: username || makeUsername(user.email, user.user_metadata?.full_name || user.user_metadata?.name),
    xp: 0,
    level: 1,
    streak: 0,
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  if (error && error.code !== "23505") {
    throw error;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    if (!supabase) {
      throw new Error(supabaseConfigError);
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
    return data;
  }

  async function signUp({ username, email, password }) {
    if (!supabase) {
      throw new Error(supabaseConfigError);
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await insertProfileForUser(data.user, username);
    }

    return data;
  }

  async function signInWithGoogle() {
    if (!supabase) {
      throw new Error(supabaseConfigError);
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/learn`,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async function signOut() {
    if (!supabase) {
      throw new Error(supabaseConfigError);
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        configError: supabaseConfigError,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
