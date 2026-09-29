import { AudioLines, ScrollText, X } from "lucide-react";

import type {
  CompanionDictating,
  CompanionDictationOffer,
  CompanionWatchRetro,
} from "@vellumai/ipc-contract";

import { PillButton } from "@/components/companion-surface-primitives";
import { unplacedOfferLabelKey } from "@/components/companion-dictation-offer";
import { useTranslation } from "@/i18n";

/**
 * Expanded, mid-dictation: what the microphone is doing, and nothing else.
 *
 * No controls. Every other open state offers a way to act on itself, and this
 * one is already under the user's hand: the gesture holding the pill open is
 * the control, and letting go is how it ends. A stop button beside a key they
 * are physically holding would be a second answer to a question they have
 * already answered.
 *
 * The word is the same vocabulary a call uses for the same two facts, so a
 * microphone open for dictation and one open for a conversation do not read as
 * different machines.
 */
export function DictatingBody({
  dictating,
  dictationText,
  transcriptWidth,
}: {
  dictating: CompanionDictating;
  dictationText: string;
  transcriptWidth: number;
}) {
  const { t } = useTranslation();
  const words = dictationText.trim();
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 px-1">
      <AudioLines className="size-4 shrink-0" aria-hidden />
      {words ? (
        /* The end of the sentence, not the start of it.

           A line that filled from the start would freeze on the opening words
           and leave the speaker watching the part they are least unsure of. So
           the words sit at the end of their box, and a run longer than the
           box overflows at the start, where the clipping is. The end is the
           words' own: the box takes its direction from them, so a transcript
           in a right-to-left language ends on the left and is clipped on the
           right, and its last words stay in view the same way.

           A stated width rather than a measured one: every other state on
           this surface is as wide as its content, and a sentence has no width
           to be as wide as. The box is the same size with three words in it
           as with thirty, and the same size as the status word's box before
           there were any, so the pill takes its dictating width once and
           holds it while the words change underneath. A box that grew with
           its words would be re-measured on every partial, and the pill's
           width transition would run for as long as the speaker talked.

           Not a live region. A recogniser revises its guess several times a
           second, and a screen reader that announced each revision would be
           reading the whole line over and over behind a user who is already
           saying it. */
        <span
          dir="auto"
          className="flex justify-end overflow-hidden text-[12px] whitespace-nowrap text-white/85"
          style={{ width: transcriptWidth }}
        >
          <span className="shrink-0">{words}</span>
        </span>
      ) : (
        <span
          className="truncate text-[12px] text-white/85"
          style={{ width: transcriptWidth }}
        >
          {dictating === "listening"
            ? t("companionSurface.dictating")
            : t("companionSurface.dictatingTranscribing")}
        </span>
      )}
    </div>
  );
}

/**
 * The pill's line while a dictation's words are on offer beside it.
 *
 * Only why they are being offered: the other app that pasted its own version,
 * that nothing in front would take them, or that the paste failed. The words and the answers are on
 * the card ({@link CompanionSurfaceProps.offer}), since the pill is one line
 * tall and the words have to be read whole.
 */
export function OfferBody({
  offer,
  offerWidth,
}: {
  offer: CompanionDictationOffer;
  offerWidth: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 px-1">
      <AudioLines className="size-4 shrink-0" aria-hidden />
      <span
        className="truncate text-[12px] text-white/85"
        style={{ width: offerWidth }}
      >
        {offer.reason === "claimed"
          ? t("companionSurface.offerHeard", { app: offer.app })
          : t(unplacedOfferLabelKey(offer.reason))}
      </span>
    </div>
  );
}

/**
 * Expanded, after a session: what became of what the user narrated.
 *
 * **Two states and no third.** While the turn runs there is nothing to press,
 * so the row is a word and the ring beside it; once there is a report the row
 * is the question and its two answers. There is no state for a session that
 * produced nothing, because the surface stops drawing this at all when the
 * runtime says so, and an empty result reported as one would be a notice about
 * an absence.
 *
 * **The wait is stated, not implied.** The ring alone would be the same light
 * the assistant burns for every other turn, and the one thing this has to say
 * is which turn it is: the session the user just ended. One word, because the
 * pill is read from the corner of an eye over another app's work.
 *
 * **Both answers are drawn.** The question is asked on a surface that floats
 * over whatever the user does next, so the way out of it has to be as reachable
 * as the way in; a prompt whose only dismissal is going elsewhere is one that
 * follows them around. The summary stays in the assistant's own conversation
 * list either way, which is what makes "not now" a deferral rather than a
 * discard.
 */
export function SummaryBody({
  retro,
  onWatchRetro,
}: {
  retro: CompanionWatchRetro;
  onWatchRetro?: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  if (retro === "pending") {
    return (
      <span className="ml-1 shrink-0 text-[12px] text-white/85">
        {t("companionSurface.summarizing")}
      </span>
    );
  }
  return (
    <>
      <PillButton
        icon={<ScrollText className="size-4" />}
        label={t("companionSurface.showSummary")}
        showLabel
        onClick={() => {
          onWatchRetro?.(true);
        }}
      />
      <PillButton
        icon={<X className="size-4" />}
        label={t("companionSurface.notNow")}
        showLabel
        onClick={() => {
          onWatchRetro?.(false);
        }}
      />
    </>
  );
}
