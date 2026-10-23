"use client";

import en from "../../messages/en.json";
import sv from "../../messages/sv.json";

// Rendered outside the root layout, so there is no next-intl provider here.
export default function GlobalError({ reset }: { reset: () => void }) {
  const locale =
    typeof document !== "undefined" && /(?:^|; )locale=en/.test(document.cookie)
      ? "en"
      : "sv";
  const c = (locale === "en" ? en : sv).Common;

  return (
    <html lang={locale}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "6rem 1rem",
        }}
      >
        <h1>{c.somethingWrong}</h1>
        <p>{c.somethingWrongBody}</p>
        <button onClick={reset}>{c.tryAgain}</button>
      </body>
    </html>
  );
}
