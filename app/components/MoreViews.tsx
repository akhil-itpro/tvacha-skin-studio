"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Share2,
  Info,
  ShieldCheck,
  Sun,
  Moon,
  Bookmark,
  UserRound,
  LogOut,
  Download,
  Camera,
  ChevronRight,
  Trash2,
  Sparkles,
  Check,
  CheckCheck,
  LoaderCircle,
  Plus,
  X,
  SlidersHorizontal,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import {
  api,
  dateKey,
  prettyDate,
  errorMessage,
  money,
  type AppState,
  type Scan,
} from "../../src/client/types";
import type { Product, RoutinePlan } from "../../src/domain/types";
import { CONCERN_KEYS } from "../../src/domain/types";
import { CONCERN_META } from "../../src/domain/catalog";
import { downloadBlob, shareLabel } from "../../src/client/share";
import { PageHead, SkinLabel, Sticker, ProductCard, Empty } from "./UI";
type Common = {
  state: AppState | null;
  notify: (s: string) => void;
  refresh: () => Promise<any>;
};
export function Result({
  scan,
  plan,
  state,
  navigate,
  notify,
}: {
  scan: Scan;
  plan: RoutinePlan;
  state: AppState | null;
  navigate: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [sharing, setSharing] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="YOUR SKIN, DECODED"
        title="A label. A little direction."
        text={prettyDate(scan.createdAt)}
      >
        <button
          className="button secondary"
          disabled={sharing}
          onClick={async () => {
            if (sharing) return;
            setSharing(true);
            try {
              const r = await shareLabel(scan, plan);
              if (r === "cancelled") return;
              void api("/api/events", "POST", { name: "label_shared" }).catch(() => {});
              notify(
                r === "shared"
                  ? "Your label was shared."
                  : "Your label has been downloaded.",
              );
            } catch (e) {
              notify(errorMessage(e));
            } finally { setSharing(false); }
          }}
        >
          {sharing ? <LoaderCircle className="spin" size={17} /> : <Share2 size={17} />}
          {sharing ? "Preparing label…" : "Share my label"}
        </button>
      </PageHead>
      {scan.message && (
        <div className="alert">
          <Info size={19} />
          <p>{scan.message}</p>
        </div>
      )}
      <div className="result-grid">
        <div>
          <SkinLabel scan={scan} />
          <div className="trust-line result-trust">
            <ShieldCheck size={17} />
            <p>
              {scan.source === "photo"
                ? "AI estimate from one photo. Not a diagnosis. See a dermatologist if anything hurts, spreads or changes."
                : "Quiz-based cosmetic guidance. No photo was assessed. See a dermatologist if anything hurts, spreads or changes."}
            </p>
          </div>
        </div>
        <div className="focus-panel">
          <span className="eyebrow">A GOOD PLACE TO START</span>
          <h2>Keep your focus small.</h2>
          {plan.focusAreas.map((f, i) => (
            <div className="focus-item" key={f.key}>
              <span className="mono focus-number">0{i + 1}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.explanation}</p>
              </div>
            </div>
          ))}
          <div className="ingredient-label">
            <span className="mono">WHAT TO LOOK FOR</span>
            <p className="mono">
              {plan.ingredients.join(" / ") ||
                "GENTLE CLEANSER / MOISTURISER / SPF 30+"}
            </p>
          </div>
          <Sticker />
        </div>
      </div>
      <div className="card-heading section-heading">
        <div>
          <span className="eyebrow">FEWER STEPS. MORE CONSISTENCY.</span>
          <h2>Your everyday routine.</h2>
        </div>
        <button className="text-button" onClick={() => navigate("/routine")}>
          Start my routine
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="routine-two">
        {(["AM", "PM"] as const).map((slot) => (
          <article className="section-card" key={slot}>
            <div className="slot-heading">
              {slot === "AM" ? <Sun size={23} /> : <Moon size={22} />}
              <h3>{slot === "AM" ? "A fresh start" : "A gentle reset"}</h3>
              <span className="mono">{slot}</span>
            </div>
            {(slot === "AM" ? plan.am : plan.pm).map((s, i) => (
              <div className="routine-simple" key={s.key}>
                <span className="mono">0{i + 1}</span>
                <div>
                  <strong>
                    {s.title}
                    {s.optional ? " · optional" : ""}
                  </strong>
                  <p>{s.instruction}</p>
                  {s.owned && (
                    <small className="owned-tag">
                      Already on your shelf · {s.ownedName}
                    </small>
                  )}
                  {s.budgetNote && <p className="fine-print">{s.budgetNote}</p>}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
      {plan.notes.length > 0 && (
        <div className="care-notes">
          {plan.notes.map((n, i) => (
            <p key={i}>
              <Info size={15} />
              {n}
            </p>
          ))}
        </div>
      )}
      <div className="card-heading section-heading">
        <div>
          <span className="eyebrow">THOUGHTFUL PICKS, WITHIN REACH</span>
          <h2>A few things that fit.</h2>
          <p>
            Reference prices. Check the retailer for today’s price and
            ingredients.
          </p>
        </div>
        <span className="outlined-tag">FIT FIRST. NEVER PAID RANKING.</span>
      </div>
      {plan.products.length ? (
        <div className="products-grid">
          {plan.products.map((p) => (
            <ProductCard key={p.id} product={p} alternatives={[...plan.am, ...plan.pm].find(step => step.product?.id === p.id)?.alternatives} />
          ))}
        </div>
      ) : (
        <div className="alert">
          <CheckCheck size={20} />
          <p>
            Your shelf covers the recommended steps, or no matching product is
            available in our catalogue. See your routine notes.
          </p>
        </div>
      )}
      <p className="fine-print">
        Illustrations show routine steps, not actual product packaging.
      </p>
      {state?.user.isGuest && (
        <div className="save-banner">
          <Bookmark size={25} />
          <div>
            <h3>Give your label a home.</h3>
            <p>
              Sign in to keep your labels and routine together across devices.
            </p>
          </div>
          <a
            className="button"
            href="/signin-with-chatgpt?return_to=%2Fme"
            target="_top"
          >
            Save my label
            <ArrowUpRight size={17} />
          </a>
        </div>
      )}
    </>
  );
}
export function Account({
  state,
  notify,
  navigate,
  setDialog,
  refresh,
}: Common & {
  navigate: (s: string) => void;
  setDialog: (s: "delete" | "withdraw") => void;
}) {
  const [working, setWorking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  async function download() {
    setWorking(true);
    try {
      const data = await api("/api/export");
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "tvacha-my-data-" + dateKey() + ".json");
      notify("Your data export has been downloaded.");
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR SKIN. YOUR DATA."
        title="Make yourself at home."
        text="Your preferences, your choices, your space."
      />
      <div className="account-grid">
        <section className="section-card account-profile">
          <div className="large-avatar">
            <UserRound size={32} strokeWidth={1.3} />
          </div>
          <span className="eyebrow">
            {state?.user.isGuest ? "YOUR GUEST SPACE" : "YOUR PRIVATE SPACE"}
          </span>
          <h2>
            {state?.user.isGuest
              ? "Hello, you."
              : state?.user.name || "Hello, you."}
          </h2>
          <p>
            {state?.user.isGuest
              ? "Your data is linked to this browser. Sign in to keep it across devices."
              : state?.user.email ||
                "Your skin notes are saved to your account."}
          </p>
          {state?.user.isGuest ? (
            <a
              className="button"
              href="/signin-with-chatgpt?return_to=%2Fme"
              target="_top"
            >
              Sign in to save my space
              <ArrowUpRight size={17} />
            </a>
          ) : (
            <a
              className="button secondary"
              href="/signout-with-chatgpt?return_to=%2F"
              target="_top"
            >
              <LogOut size={17} />
              Sign out
            </a>
          )}
          <div className="account-stats">
            <div>
              <strong>{state?.scanCount || 0}</strong>
              <span>skin notes</span>
            </div>
            <div>
              <strong>{state?.shelf.length || 0}</strong>
              <span>shelf staples</span>
            </div>
          </div>
          <button
            className="button secondary full"
            disabled={!state}
            onClick={async () => {
              if (!state?.profile?.ageConfirmed) { navigate("/check"); notify("Confirm you are 18 or older in Skin check before creating an invite."); return; }
              try {
                const invite = await api("/api/invite");
                const url = location.origin + "/?ref=" + invite.code;
                await navigator.clipboard.writeText(url);
                setCopied(true);
                notify("Invite link copied. No personal details are included.");
              } catch (e) {
                notify(errorMessage(e));
              }
            }}
          >
            {copied ? <Check size={17} /> : <LinkIcon size={17} />}Invite a
            friend
          </button>
        </section>
        <div>
          <section className="section-card settings-card">
            <span className="eyebrow">YOU’RE IN CONTROL</span>
            <h2>Privacy, in plain words.</h2>
            {!state?.profile?.ageConfirmed && <p className="fine-print">Start a skin check and confirm you are 18 or older to choose photo preferences.</p>}
            <button
              className="settings-row"
              disabled={working}
              onClick={download}
            >
              <Download size={20} />
              <span>
                <strong>Download my data</strong>
                <small>
                  Your labels, shelf, consents and routine ticks, as JSON.
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
            <div className="settings-row">
              <Camera size={20} />
              <span>
                <strong>Save progress photos</strong>
                <small>
                  {state?.consents.progressPhotos
                    ? "On · Only photos you choose to save."
                    : "Off · Photos are discarded after analysis."}
                </small>
              </span>
              <button
                className={
                  "toggle " + (state?.consents.progressPhotos ? "on" : "")
                }
                role="switch"
                aria-checked={!!state?.consents.progressPhotos}
                aria-label="Save progress photos"
                disabled={!state?.services.photoStorage || !state?.profile?.ageConfirmed || consentBusy}
                onClick={async () => {
                  if (state?.consents.progressPhotos) {
                    setDialog("withdraw");
                    return;
                  }
                  try {
                    setConsentBusy(true);
                    await api("/api/consents", "POST", {
                      progressPhotos: true,
                    });
                    await refresh();
                    notify(
                      "Progress photo saving enabled. You can turn it off any time.",
                    );
                  } catch (e) {
                    notify(errorMessage(e));
                  } finally { setConsentBusy(false); }
                }}
              >
                <span />
              </button>
            </div>
            <button className="settings-row" disabled={!state || consentBusy} onClick={async () => {
              if (!state?.consents.analysis) { navigate("/check"); return; }
              setConsentBusy(true);
              try { await api("/api/consents", "POST", { analysis: false }); await refresh(); notify("Photo analysis consent withdrawn. You can still use quiz routines."); }
              catch (error) { notify(errorMessage(error)); } finally { setConsentBusy(false); }
            }}>
              <ShieldCheck size={20} /><span><strong>{state?.consents.analysis ? "Withdraw photo analysis consent" : "Review photo analysis consent"}</strong><small>{state?.consents.analysis ? "Stops future photo analysis until you choose it again." : "Review the provider notice in Skin check before choosing."}</small></span><ChevronRight size={18} />
            </button>
            <button
              className="settings-row"
              onClick={() => navigate("/privacy")}
            >
              <ShieldCheck size={20} />
              <span>
                <strong>Read the privacy notice</strong>
                <small>What’s collected, why, and how to delete it.</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              className="settings-row danger-text"
              onClick={() => setDialog("delete")}
            >
              <Trash2 size={20} />
              <span>
                <strong>Delete all my Tvacha data</strong>
                <small>Immediately. Including any saved progress photos.</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </section>
          <button className="pro-link" onClick={() => navigate("/pro")}>
            <div className="pro-symbol">
              <Sparkles size={22} />
            </div>
            <div>
              <span className="eyebrow">A LITTLE MORE, SOMEDAY</span>
              <h3>Help shape Tvacha Pro.</h3>
              <p>A waitlist. No payments. No pressure.</p>
            </div>
            <ArrowUpRight size={22} />
          </button>
          {state?.isAdmin && (
            <button className="settings-row" onClick={() => navigate("/admin")}>
              <SlidersHorizontal size={20} />
              <span>
                <strong>Founder dashboard</strong>
                <small>Service health, products and scan limits.</small>
              </span>
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
export function Pro({ state, refresh, notify }: Common) {
  const [email, setEmail] = useState(state?.user.email || "");
  const [price, setPrice] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="pro-page">
      <span className="outlined-tag">NOT AVAILABLE YET</span>
      <span className="eyebrow">FOR THE LONGER SKIN STORY</span>
      <h1>
        A little more room
        <br />
        to grow.
      </h1>
      <p>
        We’re exploring Tvacha Pro. More check-ins, a full history, and a
        private progress-photo timeline. Nothing to buy today.
      </p>
      <div className="pro-features">
        {[
          "More scans, subject to service limits",
          "Your complete label history",
          "A private progress-photo timeline",
        ].map((x) => (
          <span key={x}>
            <Check size={17} />
            {x}
          </span>
        ))}
      </div>
      {state?.waitlist ? (
        <div className="success-card">
          <CheckCheck size={28} />
          <h2>You’re on the list.</h2>
          <p>Thanks for helping shape what comes next.</p>
          <button className="button secondary" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await api("/api/waitlist", "DELETE", {}); await refresh(); notify("You’ve left the Pro waitlist."); }
            catch (error) { notify(errorMessage(error)); } finally { setBusy(false); }
          }}>{busy ? "Leaving…" : "Leave waitlist"}</button>
        </div>
      ) : (
        <form
          className="section-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/api/profile", "POST", { ageConfirmed: true });
              await api("/api/waitlist", "POST", {
                email,
                price: price || undefined,
              });
              await refresh();
              notify("You’re on the Pro waitlist. No payment has been taken.");
            } catch (err) {
              notify(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field-label">
            What would feel reasonable? <span>Optional</span>
            <select value={price} onChange={(e) => setPrice(e.target.value)}>
              <option value="">I’d rather not say</option>
              <option value="49">₹49 / month</option>
              <option value="99">₹99 / month</option>
              <option value="199">₹199 / month</option>
              <option value="wouldnt_pay">I wouldn’t pay</option>
            </select>
          </label>
          <label className="checkbox-card">
            <input
              required
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              <strong>I am 18 or older. Email me when Pro is ready</strong>
              <small>
                Only updates about Pro. Leave the waitlist here at any time.
              </small>
            </span>
          </label>
          <button className="button full" disabled={busy || !consent}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}Join the
            waitlist
            <ArrowRight size={18} />
          </button>
          <p className="fine-print">
            No payment details. No subscription. No hidden commitment.
          </p>
        </form>
      )}
    </div>
  );
}
export function Legal({
  type,
  navigate,
  details,
}: {
  type: "privacy" | "terms";
  navigate: (p: string) => void;
  details?: AppState["siteDetails"];
}) {
  return (
    <article className="legal-page">
      <button className="text-button" onClick={() => navigate("/me")}>
        <ArrowLeft size={17} />
        My account
      </button>
      <span className="outlined-tag draft">DRAFT · LEGAL REVIEW PENDING</span>
      <h1>
        {type === "privacy"
          ? "Your data, in plain words."
          : "A few ground rules."}
      </h1>
      <p className="mono">LAST UPDATED / 25 OCTOBER 2026 · VERSION 1.1</p>
      {type === "privacy" ? (
        <>
          <h2>What Tvacha collects</h2>
          <p>
            We save your quiz answers, cosmetic skin labels, daily routine
            ticks, shelf items, and time-stamped consent choices. If you sign
            in, we receive a site-specific account identifier and the email or
            name provided by the hosting platform. We record a small set of
            product and app events to understand use. We do not use ad pixels or
            session recordings.
          </p>
          <h2>What happens to a selfie</h2>
          <p>
            With your separate consent, your image is sent over HTTPS to the
            configured AI provider to estimate visible cosmetic concerns. Tvacha
            does not save the selfie by default or include it in application
            logs. Photo processing uses Groq with inference zero data retention
            enabled for this app’s account. Groq still collects usage metadata,
            which does not include image inputs or generated responses.
            Processing remains subject to its terms and legal obligations. An
            alternative Google Gemini configuration requires paid-service data
            protections; the unpaid tier is not used for selfies.
          </p>
          <h2>Progress photos are your choice</h2>
          <p>
            Saving photos is off by default. If you opt in, photos are kept in
            private server storage and accessible only through an
            owner-authorised request. Delete one photo in My progress, or
            withdraw photo consent in My account to delete all saved photos.
          </p>
          <h2>Who can see your records</h2>
          <p>
            Each request checks your signed-in identity or secure guest session.
            Product information is shared; labels, consents, ticks, shelf items,
            and photos are private. Guest access is tied to this browser.
            Sign-in moves your guest space into your account.
          </p>
          <h2>How long records stay</h2>
          <p>
            Your app data stays until you delete it. Download it as JSON in My
            account. Deletion removes records and stored photos from active
            storage immediately. Provider security logs and backups, where
            applicable, follow their own retention policies. Deleting Tvacha
            data does not delete your sign-in provider account.
          </p>
          <h2>Your choices and contact</h2>
          <p>
            Skip photo analysis, refuse photo saving, withdraw consent, export
            records, or delete your data. Tvacha is for adults 18 and older.
            Contact details appear below. The operator must appoint a grievance
            contact and obtain legal review before opening the app to the public.
          </p>
          <h2>Infrastructure and external services</h2>
          <p>
            Sites and Cloudflare host the app and storage. ChatGPT sign-in is
            supplied by the hosting platform. Face detection runs on your device
            and does not send images to MediaPipe. Fonts are self-hosted.
            Detector assets are fetched from external hosts, which receive
            ordinary connection data. MediaPipe may send utilisation or
            performance metrics under its own terms. No health diagnosis is
            made.
          </p>
        </>
      ) : (
        <>
          <h2>Cosmetic guidance for adults</h2>
          <p>
            Tvacha helps adults choose a simple cosmetic skincare routine. It
            does not diagnose, predict or treat diseases. A selfie cannot
            establish skin health. See a qualified dermatologist for painful,
            spreading, bleeding, changing or persistent symptoms.
          </p>
          <h2>Estimates have limits</h2>
          <p>
            Camera, lighting, makeup and image quality affect results. AI
            estimates may be wrong and performance may vary between people.
            Confidence labels describe uncertainty. Quiz-only routines include
            no photo findings. We make no promises about results or timing.
          </p>
          <h2>Product recommendations</h2>
          <p>
            Code selects cosmetic products by budget, fit and your preferences.
            Product illustrations are generic and do not show actual packaging.
            Prices are reference prices. Check the retailer’s current price,
            full ingredients and directions. Formulas can change, and
            fragrance-free does not guarantee no irritation.
          </p>
          <h2>Use care with new products</h2>
          <p>
            Introduce one new active at a time, patch test for 24–48 hours and
            follow manufacturer directions. Stop a product that irritates your
            skin. Pregnancy and breastfeeding preferences restrict picks and do
            not replace individual medical advice.
          </p>
          <h2>Commercial links and Pro</h2>
          <p>
            Recommendations are not paid placements. Affiliate links show “We
            may earn a commission” beside the buy link. Ordinary brand links are
            labelled as such. Tvacha Pro is a waitlist only; no payments or
            subscriptions are offered.
          </p>
          <h2>Your account and availability</h2>
          <p>
            Keep access to your sign-in account secure. Guests may lose access
            when browser cookies are cleared. Service availability and scan
            limits may vary. You can export or delete your data. These terms
            require operator details, grievance contact and legal review before
            public launch.
          </p>
        </>
      )}
      <h2>Operator and support</h2>
      <p>{details?.operatorName ? `Operated by ${details.operatorName}.` : "Operator details pending."}{" "}
        {details?.supportEmail ? <>For support or privacy requests, contact <a href={"mailto:" + details.supportEmail}>{details.supportEmail}</a>.</> : "A support contact has not been added yet."}
        {" "}The founder can update these details in the founder dashboard.</p>
      <div className="alert warning">
        <Info size={20} />
        <p>
          This is a draft. It has not been reviewed by a lawyer and does not
          claim legal compliance.
        </p>
      </div>
    </article>
  );
}
