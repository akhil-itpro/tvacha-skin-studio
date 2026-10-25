"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="main-content">
      <section className="empty-state" role="alert">
        <span className="eyebrow">A MOMENT TO RESET</span>
        <h1>Your space couldn’t load.</h1>
        <p>
          Please try again. Your saved skin notes and routine remain in your
          private account.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
        <a className="text-button" href="/">
          Back to my overview
        </a>
      </section>
    </main>
  );
}
