"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ScanFace,
  Heart,
  Sun,
  FlaskConical,
  UserRound,
  PanelTop,
  ChevronRight,
  Menu,
  Leaf,
  History,
  ShieldCheck,
  X,
  Info,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { buildRoutine } from "../../src/domain/recommendations";
import { PRODUCTS } from "../../src/domain/catalog";
import {
  api,
  errorMessage,
  type AppState,
  type Scan,
} from "../../src/client/types";
import type { QuizAnswers } from "../../src/domain/types";
import { Brand, Empty } from "./UI";
import Overview from "./Overview";
import CheckFlow from "./CheckFlow";
import { Routine, Shelf, Progress } from "./WorkspaceViews";
import { Result, Account, Pro, Legal } from "./MoreViews";
import Styleguide from "./Styleguide";
import Admin from "./AdminDashboard";
export const DEFAULT_QUIZ: QuizAnswers = {
  skinFeel: "combination",
  mainConcern: "shine",
  budget: "400to800",
  sensitivities: ["none"],
  redFlags: [],
};
export default function TvachaApp() {
  const [path, setPath] = useState("/");
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [dialog, setDialog] = useState<"delete" | "withdraw" | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = (s: string) => setToast(s);
  async function refresh() {
    try {
      const s = await api<AppState>("/api/state");
      setState(s);
      setLoadError("");
      return s;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    } finally {
      setLoading(false);
    }
  }
  function navigate(p: string) {
    window.history.pushState({}, "", p);
    setPath(p.split("?")[0]);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    setPath(location.pathname);
    const pop = () => {
      setPath(location.pathname);
      setMenu(false);
    };
    window.addEventListener("popstate", pop);
    refresh();
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^[a-f0-9]{16}$/.test(ref))
      sessionStorage.setItem("tvacha-ref", ref);
    const installed = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", installed);
    try {
      const n = Number(localStorage.getItem("tvacha-visits") || 0) + 1;
      localStorage.setItem("tvacha-visits", String(n));
      setShowInstall(
        n >= 2 && !matchMedia("(display-mode: standalone)").matches,
      );
    } catch {}
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("beforeinstallprompt", installed);
    };
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const latest =
    (path === "/label" || scan?.id.startsWith("offline-") ? scan : null) ||
    state?.scans[0] ||
    null;
  const redFlagged = !!state?.profile?.quiz?.redFlags?.length;
  const quiz = redFlagged
    ? state!.profile!.quiz!
    : latest?.quiz || state?.profile?.quiz || DEFAULT_QUIZ;
  const products = state?.products?.length ? state.products : PRODUCTS;
  const plan = buildRoutine(
    quiz,
    latest?.analysis || null,
    state?.shelf || [],
    products,
    state?.rules,
  );
  const goCheck = () => {
    setScan(null);
    navigate("/check");
  };
  const nav = [
    { p: "/", name: "My overview", Icon: PanelTop },
    { p: "/check", name: "Skin check", Icon: ScanFace },
    { p: "/routine", name: "My routine", Icon: Sun },
    { p: "/shelf", name: "My shelf", Icon: FlaskConical },
    { p: "/progress", name: "My progress", Icon: History },
  ];
  async function confirmAction() {
    setBusy(true);
    try {
      if (dialog === "delete") {
        await api("/api/account", "DELETE", { confirm: "DELETE" });
        setScan(null);
        await refresh();
        navigate("/");
        notify("Your Tvacha data has been deleted.");
      } else {
        await api("/api/consents", "POST", {
          analysis: state?.consents.analysis || false,
          progressPhotos: false,
        });
        await refresh();
        notify("Photo consent withdrawn. Saved progress photos deleted.");
      }
      setDialog(null);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "is-open" : "")}>
        <a
          href="/"
          className="brand-link"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          aria-label="Tvacha home"
        >
          <Brand />
        </a>
        <div className="sidebar-caption">A LITTLE SKIN WISDOM.</div>
        <nav aria-label="Main navigation">
          {nav.map(({ p, name, Icon }) => (
            <a
              key={p}
              href={p}
              className={"nav-link " + (path === p ? "active" : "")}
              onClick={(e) => {
                e.preventDefault();
                p === "/check" ? goCheck() : navigate(p);
              }}
            >
              <Icon size={20} />
              <span>{name}</span>
              {path === p && <span className="nav-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-flower">
            <Leaf size={24} />
          </div>
          <h3>
            Less noise.
            <br />
            More you.
          </h3>
          <p>
            Skincare that makes sense.
            <br />
            No perfect skin required.
          </p>
          <span className="mono">MADE FOR REAL SKIN</span>
        </div>
        <div className="sidebar-bottom">
          <a
            href="/me"
            className={"nav-link " + (path === "/me" ? "active" : "")}
            onClick={(e) => {
              e.preventDefault();
              navigate("/me");
            }}
          >
            <UserRound size={20} />
            My account
            <ChevronRight size={16} />
          </a>
          <div className="sidebar-privacy">
            <ShieldCheck size={13} />
            Your skin. Your data.
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-body">
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <Brand small />
          </div>
          <div className="breadcrumb">
            Your skin, understood
            <span className="tiny-dot" />
            <span className="topbar-sub">A little better, every day.</span>
          </div>
          <div className="topbar-right">
            <span className="status-pill">
              <span />
              COSMETIC CARE, ALWAYS
            </span>
            <button
              className="avatar"
              aria-label="Open my account"
              onClick={() => navigate("/me")}
            >
              {(!state?.user.isGuest && state?.user.name?.slice(0, 1).toUpperCase()) || (
                <UserRound size={18} />
              )}
            </button>
          </div>
        </header>
        <main
          id="main"
          className={"main-content " + (path === "/check" ? "check-main" : "")}
        >
          {loading ? (
            <div className="page-loading" role="status">
              <LoaderCircle className="spin" size={26} />
              <p>Getting your space ready…</p>
            </div>
          ) : (
            <>
              {loadError && (
                <div className="alert warning">
                  <Info size={19} />
                  <div>
                    <strong>Your saved space could not load.</strong>
                    <p>{loadError}</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setLoading(true);
                      refresh();
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
              {path === "/" && (
                <Overview
                  latest={latest}
                  state={state}
                  navigate={navigate}
                  goCheck={goCheck}
                />
              )}{" "}
              {path === "/check" && (
                <CheckFlow
                  state={state}
                  refresh={refresh}
                  notify={notify}
                  navigate={navigate}
                  onFinish={async (s) => {
                    setScan(s);
                    await refresh();
                    navigate("/label");
                  }}
                />
              )}
              {path === "/label" &&
                (redFlagged ? (
                  <Empty
                    Icon={Heart}
                    title="Please see a dermatologist."
                    text="You reported symptoms that need an in-person assessment. We’ve paused product recommendations."
                    action="Review my skin check"
                    onAction={goCheck}
                  />
                ) : latest ? (
                  <Result
                    scan={latest}
                    plan={plan}
                    state={state}
                    navigate={navigate}
                    notify={notify}
                  />
                ) : (
                  <Empty
                    Icon={ScanFace}
                    title="Your first label starts here."
                    text="A few questions. A little clarity. Get a routine that fits your skin and your budget."
                    action="Start my skin check"
                    onAction={goCheck}
                  />
                ))}
              {path === "/routine" &&
                (redFlagged ? (
                  <Empty
                    Icon={Heart}
                    title="Please see a dermatologist."
                    text="The symptoms you reported need an in-person assessment. We’ve paused this routine."
                    action="Review my skin check"
                    onAction={goCheck}
                  />
                ) : (
                  <Routine
                    state={state}
                    scan={latest}
                    plan={plan}
                    refresh={refresh}
                    notify={notify}
                    goCheck={goCheck}
                    onLabel={() => navigate("/label")}
                  />
                ))}{" "}
              {path === "/shelf" && (
                <Shelf
                  state={state}
                  products={products}
                  refresh={refresh}
                  notify={notify}
                />
              )}{" "}
              {path === "/progress" && (
                <Progress
                  state={state}
                  onSelect={(s) => {
                    setScan(s);
                    navigate("/label");
                  }}
                  goCheck={goCheck}
                  notify={notify}
                  refresh={refresh}
                />
              )}{" "}
              {path === "/me" && (
                <Account
                  state={state}
                  notify={notify}
                  navigate={navigate}
                  setDialog={setDialog}
                  refresh={refresh}
                />
              )}{" "}
              {path === "/pro" && (
                <Pro state={state} refresh={refresh} notify={notify} />
              )}{" "}
              {(path === "/privacy" || path === "/terms") && (
                <Legal
                  type={path === "/privacy" ? "privacy" : "terms"}
                  navigate={navigate}
                />
              )}{" "}
              {path === "/admin" && (
                <Admin state={state} notify={notify} refresh={refresh} />
              )}{" "}
              {path === "/styleguide" && <Styleguide />}{" "}
              {![
                "/",
                "/check",
                "/label",
                "/routine",
                "/shelf",
                "/progress",
                "/me",
                "/pro",
                "/privacy",
                "/terms",
                "/admin",
                "/styleguide",
              ].includes(path) && (
                <Empty
                  Icon={Leaf}
                  title="A little off the path."
                  text="This page doesn’t exist. Your skincare space is right here."
                  action="Back to my overview"
                  onAction={() => navigate("/")}
                />
              )}
            </>
          )}
          <footer className="footer">
            <span>
              <Brand small />
              <span>Simple care. Real skin.</span>
            </span>
            <div>
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/privacy");
                }}
              >
                Privacy
              </a>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/terms");
                }}
              >
                Terms
              </a>
              <span>For adults 18+</span>
            </div>
          </footer>
        </main>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {[
            { p: "/", name: "Check", Icon: ScanFace },
            { p: "/routine", name: "Routine", Icon: Sun },
            { p: "/shelf", name: "Shelf", Icon: FlaskConical },
            { p: "/me", name: "Me", Icon: UserRound },
          ].map(({ p, name, Icon }) => (
            <button
              key={p}
              className={
                path === p || (p === "/" && ["/check", "/label"].includes(path))
                  ? "active"
                  : ""
              }
              onClick={() => navigate(p)}
            >
              <Icon size={21} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {showInstall && path === "/me" && (
        <div className="install-banner">
          <Leaf size={22} />
          <div>
            <strong>A home for your routine.</strong>
            <p>
              {installEvent
                ? "Install Tvacha for a quicker start."
                : "Use your browser’s Share or menu button, then “Add to Home Screen”."}
            </p>
          </div>
          {installEvent && (
            <button
              className="button small"
              onClick={async () => {
                await installEvent.prompt();
                setInstallEvent(null);
                setShowInstall(false);
              }}
            >
              Install
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss install hint"
            onClick={() => setShowInstall(false)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {dialog && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="warning-icon">
              <Trash2 size={23} />
            </div>
            <h2 id="dialog-title">
              {dialog === "delete"
                ? "Delete your Tvacha data?"
                : "Delete your progress photos?"}
            </h2>
            <p>
              {dialog === "delete"
                ? "This immediately deletes your labels, routine ticks, shelf, consents, waitlist entry, and saved photos. This cannot be undone. Your hosting-provider sign-in account is separate."
                : "All saved face photos will be deleted, and future photos won’t be saved. Your labels and routines stay."}
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                Keep my data
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={confirmAction}
              >
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Trash2 size={17} />
                )}
                Delete{dialog === "delete" ? " all data" : " photos"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
