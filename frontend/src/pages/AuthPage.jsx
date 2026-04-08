import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";

export function AuthPage() {
  const { user, loading, signIn, signUp, configError } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const demoEmail = import.meta.env.VITE_DEMO_EMAIL || "";
  const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || "";

  const redirectPath = location.state?.from || "/learn";

  useEffect(() => {
    if (!loading && user) {
      navigate("/learn", { replace: true });
    }
  }, [loading, user, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (mode === "signin") {
        await signIn(form.email, form.password);
      } else {
        await signUp(form);
      }
      navigate(redirectPath, { replace: true });
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    if (!demoEmail || !demoPassword) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await signIn(demoEmail, demoPassword);
      navigate("/learn", { replace: true });
    } catch (authError) {
      setError(authError.message || "Demo sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <section className="auth-hero">
          <div>
            <div className="eyebrow">AlgoRythm Platform</div>
            <h1>{t("auth.title")}</h1>
            <p className="meta-text">{t("auth.subtitle")}</p>
          </div>

          <div className="auth-points">
            <div className="auth-point">{t("auth.points1")}</div>
            <div className="auth-point">{t("auth.points2")}</div>
            <div className="auth-point">{t("auth.points3")}</div>
          </div>
        </section>

        <section className="auth-form">
          <div className="auth-tabs">
            <button
              className={`auth-tab${mode === "signin" ? " is-active" : ""}`}
              type="button"
              onClick={() => setMode("signin")}
            >
              {t("auth.signInTab")}
            </button>
            <button
              className={`auth-tab${mode === "signup" ? " is-active" : ""}`}
              type="button"
              onClick={() => setMode("signup")}
            >
              {t("auth.signUpTab")}
            </button>
          </div>

          <form className="stack" onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
            {mode === "signup" ? (
              <div className="field">
                <label htmlFor="username">{t("auth.username")}</label>
                <input
                  id="username"
                  type="text"
                  value={form.username}
                  onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
                  required
                />
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">{t("auth.password")}</label>
              <input
                id="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                required
              />
            </div>

            {configError ? <div className="inline-error">{configError}</div> : null}
            {error ? <div className="inline-error">{error}</div> : null}

            <div className="button-row">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? t("auth.working") : mode === "signin" ? t("auth.signInButton") : t("auth.signUpButton")}
              </button>
              {mode === "signin" && demoEmail && demoPassword ? (
                <button className="ghost-button" type="button" disabled={submitting} onClick={handleDemoLogin}>
                  {t("auth.demoButton")}
                </button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
