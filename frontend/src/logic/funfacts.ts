/**
 * Solar Explorer — contextual fun facts for Linear mode.
 *
 * Returns the fun fact whose trigger distance has most recently been crossed,
 * localized to the requested language, skipping any fact already shown.
 *
 * (Not part of the original architecture sketch; provides the home for the
 * fun-fact retrieval logic the tests require.)
 */
import { FunFactId, Language } from '../constants/constants';
import funfactsJson from '../config/funfacts.json';

/** A localized fun fact resolved for display. */
export interface FunFact {
  readonly id: FunFactId;
  readonly triggerDistanceMkm: number;
  readonly text: string;
}

/** Shape of a single entry in `funfacts.json`. */
interface FunFactConfig {
  readonly id: string;
  readonly triggerDistanceMkm: number;
  readonly en: { readonly text: string };
  readonly es: { readonly text: string };
}

/**
 * Resolve the fun fact triggered at a given solar distance.
 *
 * Among facts whose trigger distance has been reached and that have not yet
 * been shown, the one with the greatest trigger distance (the most recently
 * crossed) is returned.
 *
 * @param distanceMkm Current distance from the Sun in million km.
 * @param lang Language for the returned text.
 * @param shownIds Ids of facts already displayed (skipped to avoid repeats).
 * @returns The triggered fun fact, or null if none applies.
 */
export function getFunFactsAtDistance(
  distanceMkm: number,
  lang: Language,
  shownIds: ReadonlySet<string>,
): FunFact | null {
  if (!Array.isArray(funfactsJson)) return null;
  const facts = funfactsJson as FunFactConfig[];

  let best: FunFactConfig | null = null;
  for (const fact of facts) {
    const reached = fact.triggerDistanceMkm <= distanceMkm;
    const alreadyShown = shownIds.has(fact.id);
    if (!reached || alreadyShown) continue;
    if (best === null || fact.triggerDistanceMkm > best.triggerDistanceMkm) {
      best = fact;
    }
  }

  if (best === null) return null;
  return {
    id: best.id as FunFactId,
    triggerDistanceMkm: best.triggerDistanceMkm,
    text: best[lang].text,
  };
}
