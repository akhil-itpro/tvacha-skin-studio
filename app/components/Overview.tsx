"use client";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ShieldCheck,
  Sun,
  Moon,
  Leaf,
  ScanFace,
  SlidersHorizontal,
} from "lucide-react";
import type { AppState, Scan } from "../../src/client/types";
import { dateKey, prettyDate } from "../../src/client/types";
import { ProductArt, SkinLabel, Sticker, SwatchStrip } from "./UI";
export default function Overview({
  latest,
  state,
  navigate,
  goCheck,
}: {
  latest: Scan | null;
  state: AppState | null;
  navigate: (s: string) => void;
  goCheck: () => void;
}) {
  const done =
    state?.ticks.filter((t) => t.date === dateKey() && t.done).length || 0;
  const weekly =
    latest && Date.now() - new Date(latest.createdAt).getTime() >= 7 * 86400000;
  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">YOUR EVERYDAY SKIN SPACE</div>
          <h1>
            A little care goes a long way<span>.</span>
          </h1>
        </div>
        <span className="today mono">
          {new Intl.DateTimeFormat("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
            .format(new Date())
            .toUpperCase()}
          <Sun size={18} />
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="section-tag">
            <span />
            LESS GUESSWORK. MORE GOOD SKIN DAYS.
          </span>
          <h2>
            Your skin has a story.
            <br />
            Let’s read the label.
          </h2>
          <p>
            Understand what your skin needs, and what to skip.
            <br className="desktop-break" /> A simple routine. Products in your
            budget. All you.
          </p>
          <button className="button" onClick={goCheck}>
            {weekly
              ? "Time for this week’s label"
              : latest
                ? "Check in with your skin"
                : "Start my skin check"}
            <ArrowUpRight size={20} />
          </button>
          <div className="hero-foot">
            <span>
              <Check size={14} />
              About 2 minutes
            </span>
            <span>
              <Check size={14} />
              No account needed
            </span>
            <span>
              <Check size={14} />
              18+ only
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-grid" />
          <div className="hero-arch">
            <FaceIllustration />
          </div>
          <span className="visual-mark mono">
            SKIN IS HUMAN.
            <br />
            KEEP IT THAT WAY.
          </span>
          <div className="floating-swatch">
            <SwatchStrip />
            <div>
              <span className="mono">YOUR SKIN, DECODED</span>
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className="hero-stamp">
            <ShieldCheck size={19} />
            <span>
              Private by
              <br />
              <strong>design.</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="trust-line">
        <ShieldCheck size={16} />
        <p>
          Tvacha doesn’t save your selfie by default. Saving progress photos is
          always your choice.
        </p>
        <span>AI ESTIMATE. NOT A DOCTOR.</span>
      </div>
      <section className="overview-grid">
        <article className="section-card label-preview">
          <div className="card-heading">
            <div>
              <span className="eyebrow">
                {latest ? "YOUR LATEST CHECK-IN" : "A LITTLE PREVIEW"}
              </span>
              <h2>{latest ? "Your skin label" : "Meet your Skin Label"}</h2>
            </div>
            <span className="outlined-tag">
              {latest ? prettyDate(latest.createdAt) : "THE GOOD KIND OF LABEL"}
            </span>
          </div>
          <p className="card-intro">
            {latest
              ? "A snapshot, not a score. Here’s where to focus."
              : "Six things to understand. Zero things to judge."}
          </p>
          <SkinLabel scan={latest} sample={!latest} compact />
          <button
            className="text-button label-link"
            onClick={() => (latest ? navigate("/label") : goCheck())}
          >
            {latest ? "Open my full label" : "Make it yours"}
            <ArrowRight size={17} />
          </button>
        </article>
        <div className="overview-right">
          <article className="section-card routine-preview">
            <div className="card-heading">
              <div>
                <span className="eyebrow">SMALL STEPS, EVERY DAY</span>
                <h2>Your daily rhythm</h2>
              </div>
              <Sun size={23} strokeWidth={1.3} />
            </div>
            <div className="rhythm-row">
              <div className="rhythm-icon">
                <Sun size={21} />
              </div>
              <div>
                <h3>A fresh start</h3>
                <p>Cleanse. Hydrate. Protect.</p>
              </div>
              <span className="mono">AM</span>
            </div>
            <div className="rhythm-row">
              <div className="rhythm-icon night">
                <Moon size={20} />
              </div>
              <div>
                <h3>A gentle reset</h3>
                <p>Wash the day away. Give back.</p>
              </div>
              <span className="mono">PM</span>
            </div>
            <div className="routine-preview-bottom">
              <span className="mono">
                {latest
                  ? `${done} STEPS TICKED TODAY`
                  : "BUILD A ROUTINE THAT FITS YOU"}
              </span>
              <button
                aria-label="Open my routine"
                className="round-button"
                onClick={() => (latest ? navigate("/routine") : goCheck())}
              >
                <ArrowUpRight size={21} />
              </button>
            </div>
          </article>
          <article className="shelf-preview">
            <div>
              <span className="eyebrow">USE WHAT YOU HAVE</span>
              <h2>A shelf, not a shopping list.</h2>
              <p>Add what you own. We’ll work with it.</p>
              <button
                className="text-button"
                onClick={() => navigate("/shelf")}
              >
                Open my shelf
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="mini-bottles">
              <ProductArt step="moisturiser" small />
              <ProductArt step="treatment" small />
            </div>
          </article>
        </div>
      </section>
      <section className="how-section">
        <div className="card-heading">
          <div>
            <span className="eyebrow">SKINCARE, WITHOUT THE SPIRAL</span>
            <h2>A little clarity in three steps.</h2>
          </div>
          <span className="mono">01 — 03</span>
        </div>
        <div className="how-grid">
          {[
            {
              n: "01",
              Icon: SlidersHorizontal,
              title: "Tell us a little",
              text: "Your skin, your budget, your sensitivities. Four quick questions.",
            },
            {
              n: "02",
              Icon: ScanFace,
              title: "Take a closer look",
              text: "A selfie check, or just the quiz. Always cosmetic guidance.",
            },
            {
              n: "03",
              Icon: Leaf,
              title: "Keep it simple",
              text: "A few clear steps. Thoughtful product picks. Nothing extra.",
            },
          ].map(({ n, Icon, title, text }) => (
            <div className="how-item" key={n}>
              <div className="how-top">
                <span className="mono">{n}</span>
                <Icon size={23} strokeWidth={1.4} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="manifesto">
        <Leaf size={42} strokeWidth={1} />
        <p>
          Real skin has texture. And pores. And days.
          <br />
          <strong>We’re here for all of them.</strong>
        </p>
        <Sticker />
      </div>
    </>
  );
}
function FaceIllustration() {
  return (
    <svg
      viewBox="0 0 300 350"
      className="face-art"
      fill="none"
      aria-label="Line illustration of a face"
    >
      <path
        d="M70 330c4-50 36-53 43-89M190 234c0 55 36 50 50 96"
        stroke="#496C62"
        strokeWidth="1.5"
      />
      <path
        d="M87 103c-17 42-10 76 7 108 14 28 42 51 63 50 29-1 62-37 72-74 9-34 8-63-4-94"
        fill="#D3DED0"
        stroke="#496C62"
        strokeWidth="1.4"
      />
      <path
        d="M86 142C54 92 75 30 130 27c33-26 109 13 111 61 1 27-11 54-11 54s-9-35-20-44c-23 11-60-11-77-21-14 26-32 43-47 65Z"
        fill="#769182"
        stroke="#496C62"
        strokeWidth="1.5"
      />
      <path
        d="M106 143q15-10 29 1m34-1q16-12 30-1M114 151q9 7 18-1m42 0q10 7 19 0m-39-2-10 35q8 7 18-1m-31 27q22 10 40-3m-36 5q17 18 32-2"
        stroke="#496C62"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M77 156c-19-15-18 21 7 28m146-30c23-13 17 22-4 30M117 252c18 15 47 21 74-1"
        stroke="#496C62"
        strokeWidth="1.4"
      />
      <circle cx="116" cy="179" r="15" fill="#BBCCB6" />
      <circle cx="192" cy="177" r="15" fill="#BBCCB6" />
      <path
        d="M38 222h52m119-110h45M201 214h55"
        stroke="#6E8B7A"
        strokeDasharray="3 4"
      />
      <circle cx="39" cy="222" r="4" fill="#B17A3B" />
      <circle cx="256" cy="112" r="4" fill="#1670E3" />
      <circle cx="256" cy="214" r="4" fill="#7D540E" />
      <path
        d="M55 63v16m-8-8h16M240 267v16m-8-8h16"
        stroke="#6E8B7A"
        strokeWidth="1.3"
      />
    </svg>
  );
}
