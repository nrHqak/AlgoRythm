import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.jsx";
import { useLocale } from "../hooks/useLocale.jsx";

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();
  const bars = [5, 3, 8, 4, 7, 2, 6];

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <div className="landing-brand">
          <div className="landing-brand-signal" aria-hidden="true">
            {[34, 62, 100, 72, 46].map((height) => (
              <span key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
          <div className="landing-wordmark">
            <div className="landing-wordmark-title">AlgoRythm</div>
          </div>
        </div>

        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
            {t("landing.primaryCta")}
          </button>
        </div>
      </header>

      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="section-kicker">
              <span aria-hidden="true" />
              {t("landing.eyebrow")}
            </div>
            <h1>{t("landing.title")}</h1>
            <p>{t("landing.subtitle")}</p>
            <div className="button-row">
              <button className="primary-button landing-cta" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
                {t("landing.primaryCta")}
              </button>
            </div>
          </div>

          <div className="landing-visual">
            <div className="landing-showcase">
              <div className="showcase-top">
                <strong>Execution signal</strong>
                <span className="module-status"><i /> LIVE TRACE</span>
              </div>
              <div className="showcase-screen">
                <div className="signal-code-row">
                  <span>06</span>
                  <code>if arr[j] &gt; arr[j + 1]:</code>
                </div>
                <div className="signal-readout">
                  <span>STEP / 018</span>
                  <span>EVENT / COMPARE</span>
                </div>
                <div className="showcase-bars">
                  {bars.map((value, index) => (
                    <span className="showcase-bar-column" key={`${value}-${index}`}>
                      <span
                        className={`showcase-bar${index === 2 || index === 3 ? " is-active" : ""}`}
                        style={{ height: `${value * 11}%` }}
                      />
                      <small>{value}</small>
                    </span>
                  ))}
                </div>
                <div className="execution-rail" aria-label="Execution timeline, step 7 of 12">
                  {Array.from({ length: 12 }, (_, index) => (
                    <span
                      key={index}
                      className={`${index < 7 ? "is-complete" : ""}${index === 6 ? " is-current" : ""}`}
                    />
                  ))}
                </div>
                <div className="showcase-footer">
                  <span><i className="legend-swatch is-compare" /> COMPARE</span>
                  <span><i className="legend-swatch is-swap" /> SWAP</span>
                  <strong>AUDIO / ON</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--contrast">
          <div className="landing-section-heading">
            <div className="section-kicker">
              <span aria-hidden="true" />
              {t("landing.sectionEyebrow")}
            </div>
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

        <section className="landing-grid" aria-label="Platform details">
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
          <div>
            <h2>{t("landing.finalTitle")}</h2>
            <p>{t("landing.finalText")}</p>
          </div>
          <button className="primary-button" type="button" onClick={() => navigate(user ? "/learn" : "/auth")}>
            {t("landing.primaryCta")}
          </button>
        </section>
      </main>
    </div>
  );
}
