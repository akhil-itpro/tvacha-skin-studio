"use client";
import { ArrowRight, ArrowUpRight, Leaf } from "lucide-react";
import { CONCERN_META } from "../../src/domain/catalog";
import { CONCERN_KEYS, type Product } from "../../src/domain/types";
import { money, type Scan } from "../../src/client/types";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={"brand " + (small ? "brand-small" : "")}>
      <span className="brand-symbol">
        <i />
        <i />
        <i />
      </span>
      tvacha<span className="brand-period">.</span>
    </span>
  );
}
export function Sticker() {
  return (
    <div className="sticker">
      <span>GO SLOW. KEEP IT KIND.</span>
      <Leaf size={22} />
      <strong>
        PATCH TEST
        <br />
        FIRST
      </strong>
      <span>24–48 HOURS</span>
    </div>
  );
}
export function SwatchStrip() {
  return (
    <div className="swatch-strip" aria-hidden="true">
      {CONCERN_KEYS.map((k) => (
        <span key={k} style={{ background: CONCERN_META[k].color }} />
      ))}
    </div>
  );
}
export function ProductArt({
  step,
  small = false,
}: {
  step: string;
  small?: boolean;
}) {
  return (
    <div
      className={"product-art art-" + step + (small ? " small" : "")}
      aria-hidden="true"
    >
      <div className="bottle-cap" />
      <div className="bottle">
        <span>tv.</span>
        <i />
        <small>
          {step === "sunscreen"
            ? "SPF"
            : step === "cleanser"
              ? "CLEANSE"
              : step === "treatment"
                ? "TREAT"
                : "HYDRATE"}
        </small>
      </div>
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  Icon,
  title,
  text,
  action,
  onAction,
}: {
  Icon: any;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={32} strokeWidth={1.3} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="button" onClick={onAction}>
          {action}
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}
export function SkinLabel({
  scan,
  sample = false,
  compact = false,
}: {
  scan: Scan | null;
  sample?: boolean;
  compact?: boolean;
}) {
  const levels = [2, 1, 2, 0, 1, 1];
  const photo = scan?.source === "photo" && scan.analysis;
  return (
    <div className={"skin-label " + (compact ? "compact" : "")}>
      <div className="skin-label-header">
        <div>
          <span className="mono">TVACHA / SKIN NOTES</span>
          <h3>
            {sample
              ? "Every skin. A different story."
              : photo
                ? "A little skin clarity."
                : "Your quiz. Your routine."}
          </h3>
        </div>
        <span className="label-corner">
          {sample ? "EX." : photo ? "01" : "Q."}
        </span>
      </div>
      <SwatchStrip />
      {sample && (
        <div className="sample-note mono">
          ILLUSTRATION ONLY · NOT YOUR RESULT
        </div>
      )}
      {(sample || photo) && <div className="label-confidence-key mono">HOW SURE? LOW / MEDIUM / HIGH</div>}
      {!sample && !photo ? (
        <div className="quiz-label">
          <Leaf size={25} />
          <p>Your routine is based on your answers.</p>
          <span>
            We haven’t estimated visible concerns. No photo scores have been
            created.
          </span>
        </div>
      ) : (
        <div className="concern-rows">
          {CONCERN_KEYS.map((key, i) => {
            const c = photo
              ? scan.analysis?.concerns.find((c) => c.key === key)
              : null;
            const level = c?.level ?? (sample ? levels[i] : 0);
            return (
              <div className="concern-row" key={key}>
                <span
                  className="concern-code"
                  style={{ background: CONCERN_META[key].color }}
                >
                  {CONCERN_META[key].code}
                </span>
                <span className="concern-name">{CONCERN_META[key].name}</span>
                <div className="level-bars" aria-label={`Level ${level} of 3`}>
                  {[1, 2, 3].map((n) => (
                    <i
                      key={n}
                      style={{
                        background:
                          n <= level ? CONCERN_META[key].color : undefined,
                      }}
                    />
                  ))}
                </div>
                <span className="confidence mono">
                  {sample
                    ? ["MED", "HIGH", "MED", "LOW", "MED", "LOW"][i]
                    : c?.confidence === "medium"
                      ? "MED"
                      : c?.confidence.toUpperCase() || "N/A"}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="skin-label-footer mono">
        <span>
          {sample
            ? "BATCH / YOUR NEXT CHAPTER"
            : `BATCH / ${scan?.createdAt.slice(0, 10)} · ${scan?.id.slice(0, 6).toUpperCase()}`}
        </span>
        <span>{sample ? "EXAMPLE" : photo ? "AI ESTIMATE" : "QUIZ ONLY"}</span>
      </div>
    </div>
  );
}
export function ProductCard({ product: p, alternatives = [] }: { product: Product; alternatives?: Product[] }) {
  return (
    <article className="product-card">
      <div className={"product-art-bg " + p.step}>
        <span className="product-step mono">{p.step.toUpperCase()}</span>
        <ProductArt step={p.step} />
        {p.fragranceFree && (
          <span className="product-badge">FRAGRANCE-FREE</span>
        )}
      </div>
      <div className="product-details">
        <span className="eyebrow">{p.brand}</span>
        <h3>{p.name.replace(p.brand, "").trim() || p.name}</h3>
        <p>{p.ingredients.slice(0, 3).join(" · ")}</p>
        <div className="product-price">
          <strong className="mono">{money(p.priceInr)}</strong>
          <span>{p.size}</span>
        </div>
        <a
          className="button secondary full"
          href={"/api/go/" + encodeURIComponent(p.id)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View product
          <ArrowUpRight size={17} />
        </a>
        <span className="affiliate-note">
          {p.affiliateUrl
            ? "We may earn a commission."
            : "Brand link · no affiliate commission."}
        </span>
        {alternatives.length > 0 && <details className="product-alternatives">
          <summary>Lower-cost options · {alternatives.length}</summary>
          <p>Choose one product for this step. Reference prices below.</p>
          {alternatives.map(option => <div key={option.id}>
            <a href={"/api/go/" + encodeURIComponent(option.id)} target="_blank" rel="noopener noreferrer">
              <span>{option.name}</span><strong className="mono">{money(option.priceInr)}</strong><ArrowUpRight size={15} />
            </a>
            <small>{option.size} · {option.affiliateUrl ? "We may earn a commission." : "Brand link · no affiliate commission."}</small>
          </div>)}
        </details>}
      </div>
    </article>
  );
}
