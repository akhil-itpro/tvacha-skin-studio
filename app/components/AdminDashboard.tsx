"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  Droplets,
  FlaskConical,
  Info,
  Leaf,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  UsersRound,
  X,
} from "lucide-react";
import {
  api,
  dateKey,
  errorMessage,
  money,
  prettyDate,
  type AppState,
} from "../../src/client/types";
import { CONCERN_META } from "../../src/domain/catalog";
import { validateProduct } from "../../src/domain/safety";
import {
  CONCERN_KEYS,
  type Product,
  type ProductStep,
  type SkinFeel,
} from "../../src/domain/types";
import { Empty, PageHead } from "./UI";

type Props = {
  state: AppState | null;
  notify: (message: string) => void;
  refresh: () => Promise<unknown>;
};
type EventRow = { name: string; count: number; users: number };
type AdminData = {
  funnel: EventRow[];
  daily: { date: string; count: number }[];
  totals: { scans: number; photoScans: number | null; users: number } | null;
  productClicks: { productId: string | null; count: number }[];
  dailyScanCap: number;
  waitlist: { price: string | null; count: number }[];
  retention: {
    eligible: number;
    day1: number | null;
    day7: number | null;
  } | null;
  referrals: { code: string; signups: number }[];
  products: Product[];
  security: {
    mechanism: string;
    tables: string[];
    adminOnly: string[];
    publicReadAdminWrite: string[];
  };
};
const STEP_NAMES: Record<ProductStep, string> = {
  cleanser: "Cleanser",
  treatment: "Treatment",
  moisturiser: "Moisturiser",
  sunscreen: "Sunscreen",
};
const SKIN_TYPES: SkinFeel[] = ["oily", "combination", "normal", "dry"];
const FUNNEL = [
  {
    key: "check_started",
    title: "Check started",
    text: "Opened the check flow",
  },
  { key: "quiz_done", title: "Quiz finished", text: "Saved their preferences" },
  {
    key: "capture_ok",
    title: "Photo captured",
    text: "Passed on-device checks",
  },
  {
    key: "analysis_ok",
    title: "Photo label ready",
    text: "Valid photo analysis saved",
  },
  {
    key: "result_viewed",
    title: "Result ready",
    text: "A photo or quiz result saved",
  },
  {
    key: "product_click",
    title: "Product opened",
    text: "Followed a store link",
  },
];
const PRICE_OPTIONS = [
  { key: "49", name: "₹49 / month" },
  { key: "99", name: "₹99 / month" },
  { key: "199", name: "₹199 / month" },
  { key: "wouldnt_pay", name: "Wouldn’t pay" },
  { key: "", name: "No price selected" },
];
const number = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-IN")
    : "—";
const rate = (numerator: number | null | undefined, denominator: number) =>
  typeof numerator === "number" && denominator > 0
    ? `${((numerator / denominator) * 100).toFixed(1)}%`
    : "—";
const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
function blankProduct(): Product {
  return {
    id: "",
    name: "",
    brand: "",
    step: "moisturiser",
    priceInr: 399,
    size: "",
    ingredients: [],
    concerns: [],
    skinTypes: [...SKIN_TYPES],
    fragranceFree: false,
    pregnancyCaution: true,
    budgetBand: "under400",
    url: "",
    active: true,
    hasActive: false,
    priceCheckedAt: dateKey(),
    priceNote:
      "Reference list price. Confirm the current price and ingredients at the store.",
    description: "",
  };
}
function daySeries(rows: AdminData["daily"]) {
  const day = new Date();
  day.setUTCHours(12, 0, 0, 0);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(day);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: rows.find((row) => row.date === key)?.count ?? 0,
    };
  });
}
function StepIcon({ step }: { step: ProductStep }) {
  return step === "sunscreen" ? (
    <Sun size={17} />
  ) : step === "treatment" ? (
    <FlaskConical size={17} />
  ) : step === "cleanser" ? (
    <Droplets size={17} />
  ) : (
    <Leaf size={17} />
  );
}

export default function AdminDashboard({ state, notify, refresh }: Props) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [cap, setCap] = useState("20"),
    [savingCap, setSavingCap] = useState(false),
    [capError, setCapError] = useState("");
  const [query, setQuery] = useState(""),
    [stepFilter, setStepFilter] = useState("all"),
    [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Product | null>(null),
    [isNew, setIsNew] = useState(false),
    [changingProduct, setChangingProduct] = useState("");
  const identityRef = useRef(state?.user.id);
  identityRef.current = state?.user.id;

  async function load() {
    if (!state?.isAdmin) return;
    const identity = state.user.id;
    setLoading(true);
    setError("");
    try {
      const result = await api<AdminData>("/api/admin");
      if (identityRef.current !== identity) return;
      setData(result);
      setCap(String(result.dailyScanCap));
    } catch (err) {
      if (identityRef.current === identity) setError(errorMessage(err));
    } finally {
      if (identityRef.current === identity) setLoading(false);
    }
  }
  useEffect(() => {
    if (!state?.isAdmin) {
      setData(null);
      setError("");
      return;
    }
    void load();
  }, [state?.isAdmin, state?.user.id]);

  async function saveCap(event: FormEvent) {
    event.preventDefault();
    const amount = Number(cap);
    if (
      !cap.trim() ||
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > 10000
    ) {
      setCapError("Use a whole number from 0 to 10,000.");
      return;
    }
    setSavingCap(true);
    setCapError("");
    try {
      await api("/api/admin", "PATCH", { dailyScanCap: amount });
      setData((previous) =>
        previous ? { ...previous, dailyScanCap: amount } : previous,
      );
      notify(
        amount === 0
          ? "Photo checks paused. Quiz routines are still available."
          : "Daily photo-check limit updated.",
      );
    } catch (err) {
      setCapError(errorMessage(err));
    } finally {
      setSavingCap(false);
    }
  }
  async function toggleProduct(product: Product) {
    if (changingProduct) return;
    setChangingProduct(product.id);
    try {
      const updated = { ...product, active: !product.active };
      await api("/api/admin/products", "PATCH", updated);
      setData((previous) =>
        previous
          ? {
              ...previous,
              products: previous.products.map((item) =>
                item.id === product.id ? updated : item,
              ),
            }
          : previous,
      );
      await refresh();
      notify(
        updated.active
          ? "Product activated for new recommendations."
          : "Product deactivated. It will not appear in new recommendations.",
      );
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setChangingProduct("");
    }
  }

  if (!state)
    return (
      <div className="section-card founder-loading" role="status">
        <LoaderCircle size={24} className="spin" />
        <p>Loading your account…</p>
      </div>
    );
  if (!state.isAdmin)
    return (
      <Empty
        Icon={ShieldCheck}
        title="This space is private."
        text="Founder access is checked on the server. Use an account that has been granted administrator access."
      />
    );
  if (!data)
    return (
      <div className="founder-dashboard">
        <PageHead
          eyebrow="FOUNDER’S NOTEBOOK"
          title="A clear view of the little things."
          text="Real activity. Useful guardrails. A carefully kept shelf."
        />
        {error ? (
          <div className="founder-load-error" role="alert">
            <CircleAlert size={26} />
            <h2>Your notebook couldn’t load.</h2>
            <p>{error}</p>
            <button
              className="button secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Try again
            </button>
          </div>
        ) : (
          <div className="section-card founder-loading" role="status">
            <LoaderCircle size={25} className="spin" />
            <p>Reading your founder notebook…</p>
          </div>
        )}
      </div>
    );

  const events = (name: string) =>
    data.funnel.find((row) => row.name === name)?.count ?? 0;
  const successes = events("analysis_ok"),
    failures = events("analysis_failed"),
    retakes = events("retake_needed"),
    lowConfidence = events("low_confidence");
  const attempts = successes + failures + retakes;
  const waitlistTotal = data.waitlist.reduce((sum, row) => sum + row.count, 0);
  const referralTotal = data.referrals.reduce(
    (sum, row) => sum + row.signups,
    0,
  );
  const clickTotal = data.productClicks.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const activeProducts = data.products.filter(
    (product) => product.active,
  ).length;
  const funnelMax = Math.max(1, ...FUNNEL.map((row) => events(row.key)));
  const days = daySeries(data.daily),
    maxDay = Math.max(0, ...days.map((day) => day.count)),
    last30Total = days.reduce((sum, day) => sum + day.count, 0);
  const products = data.products.filter(
    (product) =>
      (stepFilter === "all" || product.step === stepFilter) &&
      (statusFilter === "all" ||
        product.active === (statusFilter === "active")) &&
      `${product.name} ${product.brand} ${product.ingredients.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const securityTables = [
    ...new Set([
      ...data.security.tables,
      ...data.security.adminOnly,
      ...data.security.publicReadAdminWrite,
    ]),
  ];
  const eligible = data.retention?.eligible ?? 0;

  return (
    <div className="founder-dashboard">
      <PageHead
        eyebrow="FOUNDER’S NOTEBOOK"
        title="A clear view of the little things."
        text="Real activity. Useful guardrails. A carefully kept shelf."
      >
        <button
          className="button secondary"
          onClick={() => void load()}
          disabled={loading || savingCap}
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          {loading ? "Refreshing…" : "Refresh data"}
        </button>
      </PageHead>
      <div className="founder-context">
        <span className="founder-private">
          <ShieldCheck size={14} />
          FOUNDER ACCESS
        </span>
        <span>All-time records, unless a date range is shown.</span>
        <span className="mono">NO PAID RANKING</span>
      </div>
      {error && (
        <div className="alert warning" role="alert">
          <CircleAlert size={18} />
          <p>{error} Showing the last successfully loaded data.</p>
        </div>
      )}

      <section className="founder-stat-grid" aria-label="Activity overview">
        {[
          {
            label: "Saved labels",
            value: number(data.totals?.scans),
            note: "Photo and quiz routines",
            Icon: BarChart3,
          },
          {
            label: "Photo labels",
            value: number(
              data.totals?.photoScans ?? (data.totals?.scans === 0 ? 0 : null),
            ),
            note: "Valid photo estimates saved",
            Icon: Sun,
          },
          {
            label: "Spaces with labels",
            value: number(data.totals?.users),
            note: "Accounts and browser guests",
            Icon: UsersRound,
          },
          {
            label: "Pro waitlist",
            value: number(waitlistTotal),
            note: "No payments collected",
            Icon: Leaf,
          },
        ].map((metric) => (
          <article className="founder-stat" key={metric.label}>
            <div>
              <span className="eyebrow">{metric.label}</span>
              <metric.Icon size={18} strokeWidth={1.4} />
            </div>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <div className="founder-main-grid">
        <section
          className="section-card founder-chart-card"
          aria-labelledby="founder-scans-title"
        >
          <div className="founder-card-head">
            <div>
              <span className="eyebrow">SMALL CHECK-INS, OVER TIME</span>
              <h2 id="founder-scans-title">Saved labels, day by day.</h2>
            </div>
            <span className="outlined-tag">LAST 30 UTC DAYS</span>
          </div>
          <div className="founder-chart-summary">
            <strong>{number(last30Total)}</strong>
            <span>labels saved in this period</span>
          </div>
          <div
            className="founder-chart"
            role="img"
            aria-label={`${last30Total} labels saved over the last 30 UTC days. Peak daily count: ${maxDay}. A table of daily counts follows.`}
          >
            <span className="founder-chart-top mono">{number(maxDay)}</span>
            <span className="founder-chart-zero mono">0</span>
            <div className="founder-chart-lines" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="founder-bars">
              {days.map((day, index) => (
                <div
                  className="founder-bar-column"
                  key={day.date}
                  title={`${day.date}: ${day.count} saved labels`}
                >
                  <span
                    className={
                      "founder-bar " +
                      (index === 29 ? "is-today " : "") +
                      (day.count === 0 ? "is-zero" : "")
                    }
                    style={{
                      height:
                        day.count === 0
                          ? "2px"
                          : `${Math.max(2, (day.count / Math.max(1, maxDay)) * 100)}%`,
                    }}
                  />
                  <span className="founder-bar-tooltip">
                    {day.date}
                    <strong>{day.count} labels</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="founder-chart-labels mono">
            <span>{prettyDate(`${days[0].date}T12:00:00Z`)}</span>
            <span>{prettyDate(`${days[14].date}T12:00:00Z`)}</span>
            <span>Today, UTC</span>
          </div>
          {last30Total === 0 && (
            <p className="founder-chart-empty">
              No labels saved in the last 30 days. A useful starting point, too.
            </p>
          )}
          <details className="founder-chart-details">
            <summary>
              View daily counts <ChevronDown size={14} />
            </summary>
            <div className="founder-table-wrap">
              <table className="founder-table">
                <thead>
                  <tr>
                    <th scope="col">Date, UTC</th>
                    <th scope="col">Saved labels</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => (
                    <tr key={day.date}>
                      <th scope="row">{day.date}</th>
                      <td>{number(day.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section
          className="section-card founder-quality"
          aria-labelledby="founder-quality-title"
        >
          <span className="eyebrow">LOOK AFTER THE CHECK</span>
          <h2 id="founder-quality-title">How photo checks went.</h2>
          <p className="founder-card-intro">
            {number(attempts)} recorded photo-check outcomes.
          </p>
          {[
            {
              label: "Retake rate",
              count: retakes,
              description: "Photos returned for another try",
              tone: "retake",
            },
            {
              label: "Low-confidence rate",
              count: lowConfidence,
              description: "Saved labels with any uncertain area",
              tone: "uncertain",
            },
            {
              label: "Photo-check failure rate",
              count: failures,
              description: "Checks that fell back to quiz guidance",
              tone: "failed",
            },
          ].map((item) => (
            <div className="founder-quality-row" key={item.label}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <div>
                <strong className="founder-rate">
                  {rate(item.count, attempts)}
                </strong>
                <span className="mono">
                  {number(item.count)} / {number(attempts)}
                </span>
              </div>
              <div
                className={"founder-rate-track " + item.tone}
                aria-hidden="true"
              >
                <i
                  style={{
                    width: attempts
                      ? `${Math.min(100, (item.count / attempts) * 100)}%`
                      : 0,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="founder-method">
            <Info size={14} />
            Denominator: successful photo labels + quiz fallbacks + retakes. Low
            confidence can overlap successful checks. No outcomes means no rate.
          </p>
        </section>
      </div>

      <section
        className="section-card founder-funnel"
        aria-labelledby="founder-funnel-title"
      >
        <div className="founder-card-head">
          <div>
            <span className="eyebrow">FOLLOW THE LITTLE STEPS</span>
            <h2 id="founder-funnel-title">
              From first hello to a useful pick.
            </h2>
          </div>
          <span className="outlined-tag">EVENT COUNTS</span>
        </div>
        <div className="founder-funnel-list">
          {FUNNEL.map((stage, index) => {
            const row = data.funnel.find((item) => item.name === stage.key);
            const count = row?.count ?? 0;
            return (
              <div className="founder-funnel-row" key={stage.key}>
                <span className="founder-funnel-number mono">0{index + 1}</span>
                <div className="founder-funnel-copy">
                  <strong>{stage.title}</strong>
                  <span>{stage.text}</span>
                </div>
                <div className="founder-funnel-track" aria-hidden="true">
                  <i style={{ width: `${(count / funnelMax) * 100}%` }} />
                </div>
                <div className="founder-funnel-count">
                  <strong>{number(count)}</strong>
                  <span>{number(row?.users ?? 0)} spaces</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="founder-method">
          <Info size={14} />
          These are event totals, not a single conversion cohort. Repeat checks
          count again. Quiz-only routines skip capture and photo analysis.
          “Result ready” records successful result creation; it does not prove
          the screen was viewed.
        </p>
      </section>

      <div className="founder-three-grid">
        <section
          className="section-card founder-retention"
          aria-labelledby="founder-retention-title"
        >
          <span className="eyebrow">A REASON TO COME BACK</span>
          <h2 id="founder-retention-title">The return visit.</h2>
          <div className="founder-retention-grid">
            {[
              { label: "Day 1", returned: data.retention?.day1 },
              { label: "Day 7", returned: data.retention?.day7 },
            ].map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{rate(item.returned, eligible)}</strong>
                <small>
                  {eligible
                    ? `${number(item.returned)} / ${number(eligible)} eligible`
                    : "Waiting for an eligible cohort"}
                </small>
              </div>
            ))}
          </div>
          <p className="founder-method">
            Both rates use profiles at least seven days old. A return means a
            recorded app event on exactly day 1 or day 7 after profile creation,
            in UTC.
          </p>
        </section>
        <section
          className="section-card founder-waitlist"
          aria-labelledby="founder-waitlist-title"
        >
          <div className="founder-card-head">
            <div>
              <span className="eyebrow">LISTEN BEFORE BUILDING MORE</span>
              <h2 id="founder-waitlist-title">A price people chose.</h2>
            </div>
            <strong className="founder-card-total">
              {number(waitlistTotal)}
            </strong>
          </div>
          <div className="founder-price-votes">
            {PRICE_OPTIONS.map((option) => {
              const count = data.waitlist
                .filter((row) => (row.price ?? "") === option.key)
                .reduce((sum, row) => sum + row.count, 0);
              return (
                <div key={option.key}>
                  <span>{option.name}</span>
                  <strong className="mono">{number(count)}</strong>
                </div>
              );
            })}
          </div>
          <p className="founder-method">
            Stated preferences, not commitments. Pro is a waitlist; no payment
            details are collected.
          </p>
        </section>
        <section
          className="section-card founder-referrals"
          aria-labelledby="founder-referrals-title"
        >
          <span className="eyebrow">GOOD WORDS TRAVEL</span>
          <h2 id="founder-referrals-title">A friend brought them.</h2>
          <strong className="founder-referral-number">
            {number(referralTotal)}
          </strong>
          <p>Signed-in spaces attributed to an invite.</p>
          {data.referrals.length ? (
            <div className="founder-referral-list">
              {data.referrals.slice(0, 5).map((row) => (
                <div key={row.code}>
                  <code>{row.code}</code>
                  <span>
                    {number(row.signups)} signup{row.signups === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="founder-small-empty">
              <UsersRound size={20} />
              <span>No attributed signups yet.</span>
            </div>
          )}
          <p className="founder-method">
            Opaque invite codes contain no personal details. No money rewards.
          </p>
        </section>
      </div>

      <div className="founder-main-grid founder-operations">
        <section
          className="section-card founder-clicks"
          aria-labelledby="founder-clicks-title"
        >
          <div className="founder-card-head">
            <div>
              <span className="eyebrow">WHAT CAUGHT THEIR EYE</span>
              <h2 id="founder-clicks-title">Product link activity.</h2>
            </div>
            <span className="outlined-tag">{number(clickTotal)} CLICKS</span>
          </div>
          {data.productClicks.length ? (
            <div className="founder-table-wrap">
              <table className="founder-table founder-click-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Step</th>
                    <th scope="col">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {data.productClicks.map((row, index) => {
                    const product = data.products.find(
                      (item) => item.id === row.productId,
                    );
                    return (
                      <tr key={row.productId ?? `unknown-${index}`}>
                        <th scope="row">
                          <strong>{product?.name ?? "Unlisted product"}</strong>
                          <span>
                            {product?.brand ??
                              row.productId ??
                              "Product identifier unavailable"}
                          </span>
                        </th>
                        <td>{product ? STEP_NAMES[product.step] : "—"}</td>
                        <td className="mono">{number(row.count)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="founder-inline-empty">
              <ArrowUpRight size={26} />
              <strong>No product clicks recorded yet.</strong>
              <p>
                When someone opens a product through Tvacha, it will appear
                here.
              </p>
            </div>
          )}
          <p className="founder-method">
            Store-link clicks do not establish purchases or commission earned.
          </p>
        </section>
        <div className="founder-controls">
          <section className="section-card founder-limit">
            <span className="eyebrow">A SPENDING GUARDRAIL</span>
            <h2>Set a comfortable limit.</h2>
            <p>
              The global number of photo attempts allowed per UTC day. Failed
              provider attempts count too.
            </p>
            <form onSubmit={saveCap}>
              <label htmlFor="founder-scan-cap" className="field-label">
                Daily photo-check cap
              </label>
              <div className="founder-cap-fields">
                <input
                  id="founder-scan-cap"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  required
                  value={cap}
                  onChange={(event) => {
                    setCap(event.target.value);
                    setCapError("");
                  }}
                  disabled={savingCap}
                />
                <button
                  className="button"
                  type="submit"
                  disabled={savingCap || loading}
                >
                  {savingCap ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Save limit
                </button>
              </div>
              {capError && (
                <p className="founder-field-error" role="alert">
                  {capError}
                </p>
              )}
              <p className="founder-method">
                Set 0 to pause photo checks. Quiz routines stay available.
                Per-space limits also apply.
              </p>
            </form>
          </section>
          <section className="founder-service-card">
            <ShieldCheck size={24} />
            <div>
              <span className="eyebrow">CONFIGURATION, AT A GLANCE</span>
              <div className="founder-service-row">
                <strong>
                  {state.services.photoProvider || "Photo provider"}
                </strong>
                <span
                  className={state.services.photoAnalysis ? "configured" : ""}
                >
                  {state.services.photoAnalysis
                    ? "Photo checks enabled"
                    : "Setup needed"}
                </span>
              </div>
              <div className="founder-service-row">
                <strong>Private photo storage</strong>
                <span
                  className={state.services.photoStorage ? "configured" : ""}
                >
                  {state.services.photoStorage ? "Bound" : "Not set"}
                </span>
              </div>
              <p>
                {state.services.photoAnalysisReason ||
                  `Model: ${state.services.photoModel || "configured model"}. Keep inference zero data retention enabled in the provider account. Live photo accuracy still needs real-device testing.`}
              </p>
            </div>
          </section>
        </div>
      </div>

      <section
        className="founder-catalogue"
        aria-labelledby="founder-catalogue-title"
      >
        <div className="founder-catalogue-heading">
          <div>
            <span className="eyebrow">THE PRODUCT LIST IS THE PRODUCT</span>
            <h2 id="founder-catalogue-title">Curate with care.</h2>
            <p>
              {number(activeProducts)} active of {number(data.products.length)}{" "}
              catalogue entries. Fit first. Always.
            </p>
          </div>
          <button
            className="button"
            onClick={() => {
              setIsNew(true);
              setEditing(blankProduct());
            }}
          >
            <Plus size={17} />
            Add a product
          </button>
        </div>
        <div className="founder-product-toolbar">
          <div className="founder-search">
            <Search size={17} />
            <input
              aria-label="Search products"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product, brand or ingredient"
            />
          </div>
          <label>
            <span className="founder-sr-only">Filter by routine step</span>
            <select
              value={stepFilter}
              onChange={(event) => setStepFilter(event.target.value)}
            >
              <option value="all">All routine steps</option>
              {Object.entries(STEP_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="founder-sr-only">Filter by product status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="founder-product-list">
          {products.length ? (
            products.map((product) => (
              <article
                className={
                  "founder-product-row " +
                  (!product.active ? "is-inactive" : "")
                }
                key={product.id}
              >
                <div
                  className={"founder-product-symbol symbol-" + product.step}
                >
                  <StepIcon step={product.step} />
                </div>
                <div className="founder-product-info">
                  <span className="eyebrow">
                    {product.brand} / {STEP_NAMES[product.step]}
                  </span>
                  <h3>{product.name}</h3>
                  <span className="founder-product-size">
                    {product.size} ·{" "}
                    {product.fragranceFree
                      ? "Fragrance-free"
                      : "Not marked fragrance-free"}
                    {product.affiliateUrl ? " · Affiliate link" : ""}
                  </span>
                </div>
                <div className="founder-product-price">
                  <strong>{money(product.priceInr)}</strong>
                  <span>Reference price</span>
                </div>
                <span
                  className={
                    "founder-product-status " + (product.active ? "active" : "")
                  }
                >
                  {product.active ? "Active" : "Inactive"}
                </span>
                <div className="founder-product-actions">
                  <button
                    className="founder-edit-button"
                    aria-label={`Edit ${product.name}`}
                    onClick={() => {
                      setIsNew(false);
                      setEditing(product);
                    }}
                  >
                    <Pencil size={15} />
                    <span>Edit</span>
                  </button>
                  <button
                    className={
                      "founder-status-button " +
                      (product.active ? "deactivate" : "")
                    }
                    disabled={!!changingProduct}
                    onClick={() => void toggleProduct(product)}
                  >
                    {changingProduct === product.id ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : null}
                    {product.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="founder-inline-empty">
              <Search size={25} />
              <strong>No products match those filters.</strong>
              <p>Try another name or show all routine steps and statuses.</p>
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setStepFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        <p className="founder-method">
          <Info size={14} />
          Deactivation removes an entry from new picks. Verify exact pack size,
          ingredients and brand cautions when changing a price or formula.
          Commission never enters ranking.
        </p>
      </section>

      <section
        className="section-card founder-security"
        aria-labelledby="founder-security-title"
      >
        <div className="founder-card-head">
          <div>
            <span className="eyebrow">TRUST IS IN THE DETAILS</span>
            <h2 id="founder-security-title">How access is scoped.</h2>
          </div>
          <Database size={24} strokeWidth={1.3} />
        </div>
        <div className="founder-security-explainer">
          <ShieldCheck size={20} />
          <p>
            {data.security.mechanism} The table below describes the access
            design; it does not certify that a two-account security test passed.
          </p>
        </div>
        <div className="founder-table-wrap">
          <table className="founder-table founder-security-table">
            <thead>
              <tr>
                <th scope="col">Table</th>
                <th scope="col">Access design</th>
                <th scope="col">Verification needed</th>
              </tr>
            </thead>
            <tbody>
              {securityTables.map((table) => {
                const adminOnly = data.security.adminOnly.includes(table),
                  shared = data.security.publicReadAdminWrite.includes(table);
                return (
                  <tr key={table}>
                    <th scope="row">
                      <code>{table}</code>
                    </th>
                    <td>
                      {adminOnly
                        ? "Server / admin only"
                        : shared
                          ? "Shared reads; admin-only writes"
                          : "Server-scoped owner queries"}
                    </td>
                    <td>
                      {adminOnly
                        ? "Role checks"
                        : shared
                          ? "Write-permission checks"
                          : "Two independent accounts"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="founder-method">
          D1 has no PostgreSQL row-level security. Private D1/R2 bindings are
          server-only. Review owner checks, role checks, consent changes and
          deletion on the deployed app before public launch.
        </p>
      </section>

      <p className="founder-footnote">
        Counts reflect retained records. Deleting Tvacha data removes that
        person’s activity from these views. The anonymous daily cost counter is
        separate.
      </p>
      {editing && (
        <ProductEditor
          product={editing}
          isNew={isNew}
          existingIds={data.products.map((product) => product.id)}
          onClose={() => setEditing(null)}
          onSaved={async (product) => {
            setData((previous) =>
              previous
                ? {
                    ...previous,
                    products: [
                      ...previous.products.filter(
                        (item) => item.id !== product.id,
                      ),
                      product,
                    ].sort(
                      (a, b) =>
                        a.brand.localeCompare(b.brand) ||
                        a.name.localeCompare(b.name),
                    ),
                  }
                : previous,
            );
            setEditing(null);
            await refresh();
            notify("Product saved. New routines use the updated catalogue.");
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  product,
  isNew,
  existingIds,
  onClose,
  onSaved,
}: {
  product: Product;
  isNew: boolean;
  existingIds: string[];
  onClose: () => void;
  onSaved: (product: Product) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Product>({
    ...product,
    ingredients: [...product.ingredients],
    concerns: [...product.concerns],
    skinTypes: [...product.skinTypes],
  });
  const [ingredients, setIngredients] = useState(
    product.ingredients.join(", "),
  );
  const [priceText, setPriceText] = useState(String(product.priceInr));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [idEdited, setIdEdited] = useState(!isNew);
  const modalRef = useRef<HTMLDivElement>(null),
    busyRef = useRef(false);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const targets = () =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]",
        ) || [],
      );
    targets()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const all = targets();
      if (!all.length) return;
      if (event.shiftKey && document.activeElement === all[0]) {
        event.preventDefault();
        all[all.length - 1].focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === all[all.length - 1]
      ) {
        event.preventDefault();
        all[0].focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = priorOverflow;
      document.removeEventListener("keydown", keydown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  function setField<K extends keyof Product>(key: K, value: Product[K]) {
    setError("");
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function nameField(key: "name" | "brand", value: string) {
    setError("");
    setDraft((previous) => {
      const next = { ...previous, [key]: value };
      if (!idEdited) next.id = slug(`${next.brand} ${next.name}`);
      return next;
    });
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const ingredientList = [
      ...new Set(
        ingredients
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    const price = Number(priceText);
    if (isNew && existingIds.includes(draft.id)) {
      setError(
        "That catalogue ID already exists. Choose a unique ID, or edit the existing product.",
      );
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || price > 25000) {
      setError("Use a reference price above ₹0 and up to ₹25,000.");
      return;
    }
    if (
      !ingredientList.length ||
      ingredientList.length > 20 ||
      ingredientList.some((value) => value.length > 80)
    ) {
      setError(
        "Add 1–20 key ingredients separated by commas, with up to 80 characters each.",
      );
      return;
    }
    if (!draft.skinTypes.length) {
      setError("Choose at least one suitable skin feel.");
      return;
    }
    const next: Product = {
      ...draft,
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      size: draft.size.trim(),
      description: draft.description.trim(),
      ingredients: ingredientList,
      priceInr: price,
      budgetBand:
        price < 400 ? "under400" : price <= 800 ? "400to800" : "800plus",
      url: draft.url.trim(),
      priceNote: draft.priceNote.trim(),
      hasActive: draft.step === "treatment" ? true : draft.hasActive,
    };
    if (next.affiliateUrl?.trim()) next.affiliateUrl = next.affiliateUrl.trim();
    else delete next.affiliateUrl;
    if (next.step !== "sunscreen") delete next.spf;
    if (!validateProduct(next)) {
      setError(
        "Check the required fields, cosmetic-only ingredients, SPF 30+, and active/pregnancy caution flags. Exfoliating acids must be marked as active and excluded during pregnancy.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api<{ product: Product }>(
        "/api/admin/products",
        isNew ? "POST" : "PATCH",
        next,
      );
      await onSaved(result.product);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const band =
    Number(priceText) < 400
      ? "Under ₹400"
      : Number(priceText) <= 800
        ? "₹400–800"
        : "₹800+";
  return (
    <div
      className="modal-overlay founder-editor-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="modal founder-product-editor"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="founder-editor-title"
      >
        <button
          type="button"
          className="icon-button founder-editor-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Close product editor"
        >
          <X size={20} />
        </button>
        <span className="eyebrow">CURATE WITH CARE</span>
        <h2 id="founder-editor-title">
          {isNew ? "A thoughtful addition." : "Keep the details right."}
        </h2>
        <p className="founder-editor-intro">
          {isNew
            ? "Add a verified cosmetic product. Start with its current pack and official store page."
            : `${product.brand} / ${product.name}`}
        </p>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="founder-editor-fieldset">
            <legend className="founder-editor-legend">01 / The product</legend>
            <div className="founder-form-two">
              <label className="field-label">
                Product name
                <input
                  required
                  maxLength={160}
                  value={draft.name}
                  onChange={(event) => nameField("name", event.target.value)}
                  placeholder="For example, Gentle Cleanser"
                />
              </label>
              <label className="field-label">
                Brand
                <input
                  required
                  maxLength={80}
                  value={draft.brand}
                  onChange={(event) => nameField("brand", event.target.value)}
                  placeholder="Brand on the pack"
                />
              </label>
            </div>
            <label className="field-label">
              Catalogue ID
              <input
                required
                pattern="[a-z0-9-]{3,80}"
                minLength={3}
                maxLength={80}
                value={draft.id}
                readOnly={!isNew}
                onChange={(event) => {
                  setIdEdited(true);
                  setField("id", event.target.value);
                }}
                aria-describedby="founder-product-id-help"
              />
              <span id="founder-product-id-help" className="founder-input-help">
                {isNew
                  ? "A unique ID using lowercase letters, numbers and hyphens. It stays fixed after creation."
                  : "Fixed ID. This keeps saved shelf references intact."}
              </span>
            </label>
            <div className="founder-form-two">
              <label className="field-label">
                Routine step
                <select
                  value={draft.step}
                  onChange={(event) => {
                    const step = event.target.value as ProductStep;
                    setDraft((previous) => ({
                      ...previous,
                      step,
                      hasActive:
                        step === "treatment" ? true : previous.hasActive,
                      ...(step === "sunscreen"
                        ? { spf: previous.spf ?? 30 }
                        : {}),
                    }));
                  }}
                >
                  {Object.entries(STEP_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Exact pack size
                <input
                  required
                  maxLength={40}
                  value={draft.size}
                  onChange={(event) => setField("size", event.target.value)}
                  placeholder="50 ml or 100 g"
                />
              </label>
            </div>
            <label className="field-label">
              Plain description
              <textarea
                required
                maxLength={280}
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
                placeholder="A short cosmetic description. No promises or medical claims."
              />
            </label>
          </fieldset>
          <fieldset disabled={busy} className="founder-editor-fieldset">
            <legend className="founder-editor-legend">
              02 / Price and links
            </legend>
            <div className="founder-form-two">
              <label className="field-label">
                Reference price, ₹
                <input
                  required
                  type="number"
                  min="0.01"
                  max="25000"
                  step="0.01"
                  value={priceText}
                  onChange={(event) => {
                    setPriceText(event.target.value);
                    setError("");
                  }}
                />
                <span className="founder-input-help">
                  Budget band: {priceText ? band : "Enter a price"}
                </span>
              </label>
              <label className="field-label">
                Price checked on
                <input
                  required
                  type="date"
                  value={draft.priceCheckedAt}
                  onChange={(event) =>
                    setField("priceCheckedAt", event.target.value)
                  }
                />
              </label>
            </div>
            <label className="field-label">
              Price note
              <input
                required
                maxLength={200}
                value={draft.priceNote}
                onChange={(event) => setField("priceNote", event.target.value)}
              />
              <span className="founder-input-help">
                Make clear this is a reference price, not a live offer.
              </span>
            </label>
            <label className="field-label">
              Official product / approved store URL
              <input
                required
                type="url"
                maxLength={1800}
                value={draft.url}
                onChange={(event) => setField("url", event.target.value)}
                placeholder="https://…"
              />
              <span className="founder-input-help">
                HTTPS on an approved brand or retailer domain. The server
                verifies the destination.
              </span>
            </label>
            <label className="field-label">
              Affiliate URL <span>Optional</span>
              <input
                type="url"
                maxLength={1800}
                value={draft.affiliateUrl ?? ""}
                onChange={(event) =>
                  setField("affiliateUrl", event.target.value)
                }
                placeholder="Only after an affiliate relationship is approved"
              />
              <span className="founder-input-help">
                If set, the product link displays “We may earn a commission”. It
                never affects ranking.
              </span>
            </label>
          </fieldset>
          <fieldset disabled={busy} className="founder-editor-fieldset">
            <legend className="founder-editor-legend">
              03 / Fit and safety
            </legend>
            <label className="field-label">
              Key ingredients, comma separated
              <textarea
                required
                maxLength={1600}
                rows={2}
                value={ingredients}
                onChange={(event) => {
                  setIngredients(event.target.value);
                  setError("");
                }}
                placeholder="glycerin, ceramides, panthenol"
              />
            </label>
            {draft.step === "sunscreen" && (
              <label className="field-label">
                SPF
                <input
                  required
                  type="number"
                  min={30}
                  max={100}
                  step={1}
                  value={draft.spf ?? 30}
                  onChange={(event) =>
                    setField("spf", Number(event.target.value))
                  }
                />
                <span className="founder-input-help">
                  Use the pack’s SPF, 30 or higher. Verify broad-spectrum
                  protection separately.
                </span>
              </label>
            )}
            <div className="founder-checkbox-group">
              <span className="field-label">Relevant cosmetic concerns</span>
              <div className="founder-checkbox-grid">
                {CONCERN_KEYS.map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={draft.concerns.includes(key)}
                      onChange={(event) =>
                        setField(
                          "concerns",
                          event.target.checked
                            ? [...draft.concerns, key]
                            : draft.concerns.filter((item) => item !== key),
                        )
                      }
                    />
                    <span>{CONCERN_META[key].name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="founder-checkbox-group">
              <span className="field-label">
                Suitable skin feel <span>Choose at least one</span>
              </span>
              <div className="founder-checkbox-grid">
                {SKIN_TYPES.map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={draft.skinTypes.includes(key)}
                      onChange={(event) =>
                        setField(
                          "skinTypes",
                          event.target.checked
                            ? [...draft.skinTypes, key]
                            : draft.skinTypes.filter((item) => item !== key),
                        )
                      }
                    />
                    <span>{key[0].toUpperCase() + key.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="founder-check-detail">
              <input
                type="checkbox"
                checked={draft.fragranceFree}
                onChange={(event) =>
                  setField("fragranceFree", event.target.checked)
                }
              />
              <span>
                <strong>Verified fragrance-free</strong>
                <small>
                  Check the current formula. Do not assume from “gentle” or
                  “sensitive”.
                </small>
              </span>
            </label>
            <label className="founder-check-detail">
              <input
                type="checkbox"
                checked={draft.pregnancyCaution}
                onChange={(event) =>
                  setField("pregnancyCaution", event.target.checked)
                }
              />
              <span>
                <strong>Exclude during pregnancy or breastfeeding</strong>
                <small>
                  Keep on for brand cautions and exfoliating acids. An unchecked
                  box is not a medical safety claim.
                </small>
              </span>
            </label>
            <label className="founder-check-detail">
              <input
                type="checkbox"
                checked={draft.hasActive || draft.step === "treatment"}
                disabled={draft.step === "treatment" || busy}
                onChange={(event) =>
                  setField("hasActive", event.target.checked)
                }
              />
              <span>
                <strong>Contains an active treatment ingredient</strong>
                <small>
                  Required for treatment steps and exfoliating cleansers.
                  Prevents stacking new actives.
                </small>
              </span>
            </label>
            <label className="founder-check-detail">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setField("active", event.target.checked)}
              />
              <span>
                <strong>Active in recommendations</strong>
                <small>
                  Turn off to keep the record while removing it from new product
                  picks.
                </small>
              </span>
            </label>
          </fieldset>
          <div className="founder-editor-notice">
            <ShieldCheck size={18} />
            <p>
              Cosmetic, over-the-counter products only. Prescription medicines,
              steroid creams, restricted ingredients and fairness claims cannot
              enter this catalogue.
            </p>
          </div>
          {error && (
            <p className="founder-editor-error" role="alert">
              <CircleAlert size={18} />
              {error}
            </p>
          )}
          <div className="founder-editor-footer">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={17} />
              )}
              {busy
                ? "Saving product…"
                : isNew
                  ? "Add product"
                  : "Save product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
