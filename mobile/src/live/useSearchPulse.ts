/**
 * Searching “…” animation + elapsed seconds while in queue.
 */
import { useEffect, useState } from "react";
import type { LivePhase } from "./phase";

export function useSearchPulse(phase: LivePhase): {
  searchDots: number;
  searchSecs: number;
} {
  const [searchDots, setSearchDots] = useState(0);
  const [searchSecs, setSearchSecs] = useState(0);

  useEffect(() => {
    if (phase !== "search") {
      setSearchDots(0);
      setSearchSecs(0);
      return;
    }
    const started = Date.now();
    setSearchSecs(0);
    const dots = setInterval(() => {
      setSearchDots((d) => (d + 1) % 4);
    }, 450);
    const secs = setInterval(() => {
      setSearchSecs(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(dots);
      clearInterval(secs);
    };
  }, [phase]);

  return { searchDots, searchSecs };
}
