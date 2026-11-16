import { createContext, useContext, useEffect, useState } from "react";

import { supabase, supabaseConfigError } from "../lib/supabase";

const AuthContext = createContext(null);

function callbackError() {
  const url = new URL(window.location.href);
  if (url.pathname !== "/auth") return "";
  const fragment = new URLSearchParams(url.hash.slice(1));
  const fields = ["error", "error_code", "error_description"];
  if (!fields.some((key) => url.searchParams.has(key) || fragment.has(key))) return "";
  const cancelled = [url.searchParams.get("error"), fragment.get("error")].includes("access_denied");
  // Provider descriptions may contain sensitive details. Keep only a local message key.
  return cancelled ? "auth.oauthCancelled" : "auth.oauthFailed";
}

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
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id", ignoreDuplicates: true });
  if (error && error.code !== "23505") {
    throw error;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(callbackError);

  useEffect(() => {
    if (!authError) return;
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    ["error", "error_code", "error_description"].forEach((key) => {
      url.searchParams.delete(key);
      fragment.delete(key);
    });
    url.hash = fragment.toString();
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [authError]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    let revision = 0;

    // initialize() reports invalid/expired callback errors that getSession alone
    // can hide by returning a previously stored session. The SDK owns URL exchange.
    Promise.all([supabase.auth.initialize(), supabase.auth.getSession()]).then(([initialization, { data, error }]) => {
      if (!isMounted || revision !== 0) {
        return;
      }
      const failed = initialization.error || error;
      setSession(failed ? null : data?.session || null);
      setUser(failed ? null : data?.session?.user || null);
      if (failed) setAuthError((previous) => previous || (initialization.error ? "auth.oauthFailed" : "auth.sessionFailed"));
      setLoading(false);
    }).catch(() => {
      if (!isMounted || revision !== 0) return;
      setAuthError((previous) => previous || "auth.sessionFailed");
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // getSession owns initialization; later events win over its delayed snapshot.
      if (!isMounted || event === "INITIAL_SESSION") return;
      revision++;
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setAuthError("");
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
    setAuthError("");
    return data;
  }

  async function signInWithGoogle() {
    if (!supabase) throw new Error(supabaseConfigError);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) throw error;
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

    if (data.user && data.session) {
      await insertProfileForUser(data.user, username);
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
        authError,
        signIn,
        signInWithGoogle,
        signUp,
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
