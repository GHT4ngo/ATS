"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="sv">
      <body
        style={{
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "6rem 1rem",
        }}
      >
        <h1>Something went wrong / Något gick fel</h1>
        <button onClick={reset}>Try again / Försök igen</button>
      </body>
    </html>
  );
}
