"use client";

import { ErrorView } from "@/components/error-view";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorView reset={reset} />;
}
