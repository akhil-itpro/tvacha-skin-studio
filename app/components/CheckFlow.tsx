"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Leaf,
  ScanFace,
  ShieldCheck,
  Check,
  Camera,
  Info,
  Heart,
  ExternalLink,
} from "lucide-react";
import type { AppState, Scan } from "../../src/client/types";
import { api, errorMessage, canUseQuizFallback } from "../../src/client/types";
import { CONCERN_META } from "../../src/domain/catalog";
import { CONCERN_KEYS, type QuizAnswers } from "../../src/domain/types";
import CameraCapture from "./CameraCapture";
import { Empty } from "./UI";
const defaultQuiz: QuizAnswers = {
  skinFeel: "combination",
  mainConcern: "shine",
  budget: "400to800",
  sensitivities: ["none"],
  redFlags: [],
};
export default function CheckFlow({
  state,
  onFinish,
  navigate,
  notify,
  refresh,
}: {
  state: AppState | null;
  refresh: () => Promise<any>;
  onFinish: (s: Scan) => void;
  navigate: (s: string) => void;
  notify: (s: string) => void;
}) {
  const [stage, setStage] = useState(0);
  const [quiz, setQuiz] = useState<QuizAnswers>(
    state?.profile?.quiz || defaultQuiz,
  );
  const [age, setAge] = useState(false);
  const [analysisConsent, setAnalysisConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [flags, setFlags] = useState<string[]>([]);
  const [noneFlags, setNoneFlags] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(0);
  const active = useRef(true);
  const analysisAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const heading = document.querySelector<HTMLElement>(
      ".check-flow h1, .check-flow h2",
    );
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [stage]);
  useEffect(() => {
    active.current = true;
    api("/api/events", "POST", { name: "check_started" }).catch(() => {});
    return () => {
      active.current = false;
      analysisAbort.current?.abort();
    };
  }, []);
  async function saveAge() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/profile", "POST", { ageConfirmed: true });
      try {
        const ref = sessionStorage.getItem("tvacha-ref");
        if (ref) {
          await api("/api/invite", "POST", { ref }).catch(() => {});
          sessionStorage.removeItem("tvacha-ref");
        }
      } catch {}
      setStage(1);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveConsent() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/consents", "POST", {
        analysis: analysisConsent,
        // No new grant means preserve the server's current choice, never a stale browser copy.
        ...(photoConsent ? { progressPhotos: true } : {}),
      });
      setStage(2);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveQuiz() {
    setBusy(true);
    setErr("");
    try {
      await api("/api/profile", "POST", {
        ageConfirmed: true,
        quiz: { ...quiz, redFlags: flags },
      });
      api("/api/events", "POST", { name: "quiz_done" }).catch(() => {});
      await refresh();
      if (flags.length) {
        setStage(10);
      } else setStage(7);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function analyse(mode: "photo" | "quiz", photo?: string) {
    if (busy || flags.length || !noneFlags) return;
    const controller = new AbortController();
    analysisAbort.current = controller;
    setBusy(true);
    setErr("");
    setStage(9);
    setProgress(0);
    const timer = setInterval(
      () => setProgress((p) => Math.min(p + 1, 3)),
      2100,
    );
    const q = { ...quiz, redFlags: [...flags] };
    try {
      let d = await api(
        "/api/analyse",
        "POST",
        {
          quiz: q,
          mode,
          image: photo,
        },
        { signal: controller.signal },
      );
      if (!active.current || controller.signal.aborted) return;
      if (d.retake) {
        // Compatibility with an older server during deployment: complete the routine.
        d = await api("/api/analyse", "POST", { quiz: q, mode: "quiz" }, { signal: controller.signal });
        d.scan.message = "This photo could not be read reliably. Your routine is based on your answers; another photo is optional.";
      }
      if (
        photo &&
        photoConsent &&
        state?.services.photoStorage &&
        d.scan?.source === "photo"
      ) {
        try {
          await api(
            "/api/photos",
            "POST",
            { scanId: d.scan.id, image: photo },
            { signal: controller.signal },
          );
        } catch {
          notify(
            "Your label was saved, but your progress photo could not be saved.",
          );
        }
      }
      if (active.current && !controller.signal.aborted) onFinish(d.scan);
    } catch (e) {
      if (!active.current || controller.signal.aborted) return;
      if (!canUseQuizFallback(e)) {
        setErr(errorMessage(e));
        setStage(7);
        return;
      }
      const fallback: Scan = {
        id: "offline-" + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        quiz: q,
        analysis: null,
        source: "quiz",
        message:
          "We couldn’t reach the server. This quiz-only routine is available for this visit and has not been saved.",
      };
      notify(errorMessage(e));
      onFinish(fallback);
    } finally {
      clearInterval(timer);
      if (active.current) setBusy(false);
    }
  }
  const questions = [
    {
      title: "How does your skin feel by evening?",
      text: "Think about an ordinary day. No wrong answers.",
      field: "skinFeel",
      options: [
        ["oily", "Oily", "Shiny in most places"],
        ["combination", "Combination", "An oily T-zone, drier cheeks"],
        ["normal", "Balanced", "Mostly comfortable"],
        ["dry", "Dry", "Tight, thirsty or flaky"],
      ],
    },
    {
      title: "What would you like to focus on?",
      text: "Pick the one that’s on your mind most.",
      field: "mainConcern",
      options: CONCERN_KEYS.map((k) => [
        k,
        CONCERN_META[k].name,
        CONCERN_META[k].description,
      ]),
    },
    {
      title: "A comfortable budget. Per product.",
      text: "We’ll always look for a lower-cost option.",
      field: "budget",
      options: [
        ["under400", "Under ₹400", "Keep it pocket-friendly"],
        ["400to800", "₹400–800", "A little room to choose"],
        ["800plus", "₹800+", "Open to a higher spend"],
      ],
    },
    {
      title: "Anything we should be gentle about?",
      text: "Choose all that apply. This changes what we suggest.",
      field: "sensitivities",
      options: [
        ["fragrance", "Fragrance-sensitive", "Prefer fragrance-free products"],
        [
          "pregnant",
          "Pregnant or breastfeeding",
          "Keep it simple; check with your doctor",
        ],
        ["none", "None of these", "No known sensitivities"],
      ],
    },
  ];
  const q = stage >= 2 && stage <= 5 ? questions[stage - 2] : null;
  return (
    <section className="check-flow">
      <div className="flow-top">
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            stage > 0 && stage < 8 ? setStage(stage - 1) : navigate("/")
          }
        >
          <ArrowLeft size={17} />
          {stage === 0 ? "My overview" : "Back"}
        </button>
        <span className="mono">
          {q ? `QUESTION ${stage - 1} OF 4` : "A LITTLE CLARITY STARTS HERE"}
        </span>
      </div>
      {stage >= 0 && stage < 8 && (
        <div className="flow-progress">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n} className={n <= stage ? "filled" : ""} />
          ))}
        </div>
      )}
      {err && (
        <div className="alert warning">
          <Info size={18} />
          <p>{err}</p>
        </div>
      )}
      {stage === -1 && (
        <Empty
          Icon={Heart}
          title="Tvacha is for adults for now."
          text="Your skin is still changing. A trusted adult or qualified dermatologist can help you find the right care."
          action="Back to home"
          onAction={() => navigate("/")}
        />
      )}
      {stage === 0 && (
        <>
          <div className="flow-symbol">
            <Leaf size={32} />
          </div>
          <span className="eyebrow">FIRST, A QUICK HELLO</span>
          <h1>
            Skincare starts
            <br />
            with a little trust.
          </h1>
          <p className="flow-intro">
            Tvacha offers cosmetic guidance for adults.
            <br />A few questions help us keep it right for you.
          </p>
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={age}
              onChange={(e) => setAge(e.target.checked)}
            />
            <span>
              <strong>I am 18 or older</strong>
              <small>This experience is designed for adults.</small>
            </span>
          </label>
          <button
            className="button full"
            disabled={!age || busy}
            onClick={saveAge}
          >
            Let’s begin
            <ArrowRight size={18} />
          </button>
          <button className="text-button underage" onClick={() => setStage(-1)}>
            I’m under 18
          </button>
          <p className="fine-print">
            AI estimate, not a doctor. Nothing here diagnoses or treats a
            medical condition.
          </p>
        </>
      )}
      {stage === 1 && (
        <>
          <span className="eyebrow">YOUR SKIN. YOUR CHOICE.</span>
          <h1>
            Let’s keep
            <br />
            this personal.
          </h1>
          <p className="flow-intro">
            We use your answers to build your routine. Your label, shelf and
            routine ticks are saved to your private space.
          </p>
          <div className="consent-explainer">
            <ShieldCheck size={23} />
            <div>
              <strong>Photos aren’t saved by default.</strong>
              <p>
                A photo is sent securely to{" "}
                {state?.services.photoProvider || "the configured AI provider"}{" "}
                only for analysis. You can use the quiz without a selfie. See
                our draft privacy notice for provider processing.
              </p>
            </div>
          </div>
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={analysisConsent}
              onChange={(e) => setAnalysisConsent(e.target.checked)}
            />
            <span>
              <strong>Analyse my selfie for this check</strong>
              <small>Optional. Needed only if I choose photo analysis.</small>
            </span>
          </label>
          <label className="checkbox-card">
            <input
              type="checkbox"
              checked={photoConsent}
              disabled={!state?.services.photoStorage}
              onChange={(e) => setPhotoConsent(e.target.checked)}
            />
            <span>
              <strong>Save this check’s photo to follow my progress</strong>
              <small>
                {state?.services.photoStorage
                  ? "Optional. Private and deletable, one by one."
                  : "Photo storage is not connected yet. Photos won’t be saved."}
              </small>
              {state?.consents.progressPhotos && (
                <small>
                  Earlier saved photos stay private. Withdraw consent and delete
                  them in My account.
                </small>
              )}
            </span>
          </label>
          <p className="fine-print">
            Download or delete your data in My account. Withdraw photo consent
            any time.{" "}
            <a
              className="inline-link"
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the draft privacy notice
            </a>
            .
          </p>
          <button className="button full" disabled={busy} onClick={saveConsent}>
            Continue
            <ArrowRight size={18} />
          </button>
        </>
      )}
      {q && (
        <>
          <span className="eyebrow">LET’S GET TO KNOW YOUR SKIN</span>
          <h1>{q.title}</h1>
          <p className="flow-intro">{q.text}</p>
          <div className="quiz-options">
            {q.options.map(([value, title, detail]) => {
              const selected =
                q.field === "sensitivities"
                  ? quiz.sensitivities.includes(value as any)
                  : (quiz as any)[q.field] === value;
              return (
                <button
                  key={value}
                  className={"quiz-option " + (selected ? "selected" : "")}
                  aria-pressed={selected}
                  onClick={() => {
                    if (q.field === "sensitivities") {
                      const v = value as any;
                      const filtered = quiz.sensitivities.filter(
                        (s) => s !== v,
                      );
                      setQuiz({
                        ...quiz,
                        sensitivities:
                          v === "none"
                            ? ["none"]
                            : quiz.sensitivities.includes(v)
                              ? filtered.length
                                ? filtered
                                : ["none"]
                              : [
                                  ...quiz.sensitivities.filter(
                                    (s) => s !== "none",
                                  ),
                                  v,
                                ],
                      });
                    } else setQuiz({ ...quiz, [q.field]: value });
                  }}
                >
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                  <span className="option-circle">
                    {selected && <Check size={15} />}
                  </span>
                </button>
              );
            })}
          </div>
          <button className="button full" onClick={() => setStage(stage + 1)}>
            Continue
            <ArrowRight size={18} />
          </button>
        </>
      )}
      {stage === 6 && (
        <>
          <span className="eyebrow">A MOMENT FOR THE IMPORTANT THINGS</span>
          <h1>
            Some things need
            <br />a human expert.
          </h1>
          <p className="flow-intro">
            Are you experiencing any of these? A selfie can’t safely assess
            them.
          </p>
          <div className="quiz-options">
            {[
              "Painful lumps",
              "A sudden spreading rash",
              "A mole that has changed",
              "A sore that bleeds or won’t heal",
            ].map((f) => (
              <label className="checkbox-card" key={f}>
                <input
                  type="checkbox"
                  checked={flags.includes(f)}
                  onChange={(e) => {
                    setFlags(
                      e.target.checked
                        ? [...flags, f]
                        : flags.filter((x) => x !== f),
                    );
                    setNoneFlags(false);
                  }}
                />
                <span>
                  <strong>{f}</strong>
                </span>
              </label>
            ))}
            <label className="checkbox-card">
              <input
                type="checkbox"
                checked={noneFlags}
                onChange={(e) => {
                  setNoneFlags(e.target.checked);
                  if (e.target.checked) setFlags([]);
                }}
              />
              <span>
                <strong>None of these</strong>
              </span>
            </label>
          </div>
          <button
            className="button full"
            disabled={(!flags.length && !noneFlags) || busy}
            onClick={saveQuiz}
          >
            Continue
            <ArrowRight size={18} />
          </button>
        </>
      )}
      {stage === 7 && (
        <>
          <div className="flow-symbol">
            <ScanFace size={32} />
          </div>
          <span className="eyebrow">ONE LAST THING</span>
          <h1>
            A closer look,
            <br />
            if you’d like.
          </h1>
          <p className="flow-intro">
            Use a photo from the camera you have. We’ll assess readable areas
            and mark uncertain details. Your answers also help build your routine.
          </p>
          {!state?.services.photoAnalysis && (
            <div className="alert">
              <Info size={18} />
              <p>
                {state?.services.photoAnalysisReason ||
                  "Photo analysis isn’t connected yet."}{" "}
                Your quiz-based routine is ready to build.
              </p>
            </div>
          )}
          <button
            className="button full"
            disabled={
              !analysisConsent || !state?.services.photoAnalysis || busy
            }
            onClick={() => setStage(8)}
          >
            <Camera size={19} />
            Use my camera
            <ArrowRight size={18} />
          </button>
          {state?.services.photoAnalysis && !analysisConsent && (
            <p className="fine-print">
              Photo analysis needs your separate consent.{" "}
              <button className="inline-link" onClick={() => setStage(1)}>
                Review my choices
              </button>
            </p>
          )}
          <button
            className="button secondary full"
            disabled={busy}
            onClick={() => analyse("quiz")}
          >
            Build from my answers
            <ArrowRight size={18} />
          </button>
          <p className="fine-print">Same care. No photo required.</p>
        </>
      )}
      {stage === 8 && (
        <CameraCapture
          onCapture={(data) => analyse("photo", data)}
          onBack={() => setStage(7)}
        />
      )}
      {stage === 9 && (
        <div className="analysis-screen">
          <div className="analysis-mark">
            <ScanFace size={50} strokeWidth={1} />
          </div>
          <span className="eyebrow">A LITTLE CLARITY, COMING UP</span>
          <h1>
            Making sense
            <br />
            of your skin.
          </h1>
          <p>
            {
              [
                "Checking your answers and preferences…",
                "Looking for a simple, gentle starting point…",
                "Matching steps to your budget…",
                "Putting your label together…",
              ][progress]
            }
          </p>
          <div className="analysis-dots">
            <i />
            <i />
            <i />
          </div>
          <span className="fine-print">
            No perfect-skin score. Just a little direction.
          </span>
        </div>
      )}
      {stage === 10 && (
        <>
          <div className="warning-icon">
            <Heart size={30} />
          </div>
          <span className="eyebrow">PLEASE SEE A DERMATOLOGIST</span>
          <h1>
            Your skin deserves
            <br />a closer look.
          </h1>
          <p className="flow-intro">
            You mentioned {flags.join(", ").toLowerCase()}. These need an
            in-person assessment. A photo check can’t tell you what’s going on
            safely.
          </p>
          <div className="alert warning">
            <p>
              We’ve stopped this check. We won’t analyse a photo or suggest
              products for these symptoms.
            </p>
          </div>
          <a
            className="button full"
            href="https://www.google.com/maps/search/dermatologist+near+me"
            target="_blank"
            rel="noopener noreferrer"
          >
            Find a dermatologist nearby
            <ExternalLink size={18} />
          </a>
          <button
            className="button secondary full"
            onClick={() => navigate("/")}
          >
            Back to my overview
          </button>
        </>
      )}
    </section>
  );
}
