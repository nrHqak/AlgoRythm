import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="landing-wordmark">
            <div className="landing-wordmark-title">AlgoRythm</div>
            <div className="landing-wordmark-tag">{t("nav.tagline")}</div>
          </div>
        </div>

        <div className="button-row">
          <button className="ghost-button" type="button" onClick={() => navigate("/learn")}>
            {t("landing.secondaryCta")}
          </button>
          <button className="primary-button" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
            {t("landing.primaryCta")}
          </button>
        </div>
      </header>

      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="eyebrow">{t("landing.eyebrow")}</div>
            <h1>{t("landing.title")}</h1>
            <p>{t("landing.subtitle")}</p>
            <div className="button-row">
              <button className="primary-button landing-cta" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
                {t("landing.primaryCta")}
              </button>
              <button className="secondary-button" type="button" onClick={() => navigate("/learn")}>
                {t("landing.secondaryCta")}
              </button>
            </div>
          </div>

          <div className="landing-visual">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="landing-showcase">
              <div className="showcase-top">
                <div className="signal-pill">{t("landing.signalTrace")}</div>
                <div className="signal-pill">{t("landing.signalMentor")}</div>
                <div className="signal-pill">{t("landing.signalStreak")}</div>
              </div>
              <div className="showcase-screen">
                <div className="showcase-bars">
                  {[32, 54, 74, 46, 68, 88, 58].map((height, index) => (
                    <span
                      key={height}
                      className={`showcase-bar${index === 2 || index === 3 ? " is-active" : ""}`}
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>
                <div className="showcase-metrics">
                  <div className="showcase-card">
                    <span>84%</span>
                    <small>{t("landing.metric3")}</small>
                  </div>
                  <div className="showcase-card">
                    <span>1.2K</span>
                    <small>{t("landing.metric1")}</small>
                  </div>
                  <div className="showcase-card">
                    <span>347</span>
                    <small>{t("landing.metric2")}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-heading">
            <h2>{t("landing.sectionTitle")}</h2>
            <p>{t("landing.sectionText")}</p>
          </div>

          <div className="landing-features">
            <article className="landing-feature-card feature-teal">
              <h3>{t("landing.feature1Title")}</h3>
              <p>{t("landing.feature1Text")}</p>
            </article>
            <article className="landing-feature-card feature-amber">
              <h3>{t("landing.feature2Title")}</h3>
              <p>{t("landing.feature2Text")}</p>
            </article>
            <article className="landing-feature-card feature-dark">
              <h3>{t("landing.feature3Title")}</h3>
              <p>{t("landing.feature3Text")}</p>
            </article>
          </div>
        </section>

        <section className="landing-grid">
          <article className="landing-story-card">
            <h3>{t("landing.cardsTitle1")}</h3>
            <p>{t("landing.cardsText1")}</p>
          </article>
          <article className="landing-story-card">
            <h3>{t("landing.cardsTitle2")}</h3>
            <p>{t("landing.cardsText2")}</p>
          </article>
          <article className="landing-story-card">
            <h3>{t("landing.cardsTitle3")}</h3>
            <p>{t("landing.cardsText3")}</p>
          </article>
        </section>

        <section className="landing-final">
          <h2>{t("landing.finalTitle")}</h2>
          <p>{t("landing.finalText")}</p>
          <button className="primary-button" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
            {t("landing.primaryCta")}
          </button>
        </section>
      </main>
    </div>
  );
}
