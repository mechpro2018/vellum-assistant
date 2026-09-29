import { createContext, useContext } from "react";
import type { CSSProperties, ReactNode } from "react";

export type CompanionSurfaceSpotlight = "talk" | "share" | "draw" | "mute";
export type CompanionCaptionSide = "above" | "left" | "right";

const CaptionSideContext = createContext<CompanionCaptionSide>("above");

export function CompanionCaptionSideProvider({
  side,
  children,
}: {
  side: CompanionCaptionSide;
  children: ReactNode;
}) {
  return (
    <CaptionSideContext.Provider value={side}>
      {children}
    </CaptionSideContext.Provider>
  );
}

/**
 * The name's fill, named once and shared by the rectangle and its beak.
 *
 * A shared constant rather than the same literal typed twice. Translucent
 * rather than the flat fill this had before `backdrop-filter` was added:
 * the blur only has something to show once the fill lets it through. The
 * beak sits flush against the rectangle's bottom edge rather than
 * overlapping it (`top-full`, not a negative offset), so the two panes of
 * blurred backdrop meet edge to edge instead of compositing on top of each
 * other, which is what kept the flat-fill version seam-free and keeps this
 * one seam-free too.
 */
const NAME_CAPTION_FILL = "rgba(28, 28, 30, 0.55)";

/**
 * The blur and saturation boost shared by the rectangle and its beak, so the
 * one pane of "glass" reads as one material rather than two.
 *
 * An approximation of macOS's own vibrancy material, not the real thing: a
 * genuine `NSGlassEffectView` is a native layer, and this is HTML painted
 * inside the window's own transparent content, so the closest available
 * tool is Chromium's `backdrop-filter` sampling the desktop showing through
 * that transparency.
 */
const NAME_CAPTION_GLASS = "backdrop-blur-md backdrop-saturate-150";

/**
 * A name for a thing under the pointer, the way the Dock names an icon: a
 * small rectangle above it with a beak pointing down at it. The creature's
 * name for a press, and each pill control's name for the pointer on it.
 *
 * Text only, no icon: what sits beneath it is the icon already, and the
 * Dock's own tooltip carries nothing but the name. A small rectangle rather
 * than the pill's stadium shape, so the two never share a silhouette.
 *
 * `shortcut` is the key that does the same thing, after the name and dimmer
 * than it, the way a menu writes its accelerator: the name is what the control
 * is, the key is a second way to it. Glyphs rather than copy, so it is not
 * translated.
 *
 * Placed by the caller: `className` carries whether it is shown and any lift
 * off the thing it names, `style` any offsets the layout works out. Absolute
 * with no offsets of its own, so a caller that sets none gets the static
 * position, which is what the pill's controls rely on.
 *
 * `aria-hidden` throughout: whatever it names carries the same word as its
 * accessible name, and a reader told it twice is told about two things.
 */
export function Caption({
  className,
  style,
  label,
  shortcut,
  beak = "down",
  ...data
}: {
  className: string;
  style?: CSSProperties;
  label: string;
  shortcut?: string;
  /**
   * Which way the beak points, which is toward whatever the caption names:
   * down from a caption standing over it, sideways from one standing beside.
   */
  beak?: "down" | "left" | "right";
} & Partial<Record<`data-${string}`, string>>) {
  return (
    <span
      className={`pointer-events-none absolute rounded-md px-2 py-1 text-[11px] leading-4 font-medium whitespace-nowrap text-white/90 shadow-md shadow-black/30 transition-opacity duration-200 ${NAME_CAPTION_GLASS} ${className}`}
      style={{ ...style, backgroundColor: NAME_CAPTION_FILL }}
      aria-hidden
      {...data}
    >
      {label}
      {shortcut === undefined ? null : (
        <span className="ml-1.5 font-normal text-white/60" data-shortcut>
          {shortcut}
        </span>
      )}
      {/* Flush with the rectangle's own bottom edge (`top-full`) rather than
          nudged down to meet it, so the two blurred panes meet at a seam
          rather than compositing on top of each other. Centred under the
          text rather than under the whole padded box for the same reason a
          Dock label's beak centres on the name: it is pointing at the icon
          below, and the icon is what the horizontal centre of this box was
          already placed over.

          Clipped to a triangle rather than drawn with the border trick:
          `backdrop-filter` blurs an element's whole border box, transparent
          border colour or not, so the border trick left a hazy rectangular
          smudge around the visible point. `clip-path` removes those corners
          from the element entirely, so there is nothing left there for the
          blur to show through. */}
      <span
        className={`absolute ${
          beak === "down"
            ? "top-full left-1/2 h-1.5 w-2.5 -translate-x-1/2"
            : beak === "left"
              ? "top-1/2 right-full h-2.5 w-1.5 -translate-y-1/2"
              : "top-1/2 left-full h-2.5 w-1.5 -translate-y-1/2"
        } ${NAME_CAPTION_GLASS}`}
        style={{
          backgroundColor: NAME_CAPTION_FILL,
          clipPath:
            beak === "down"
              ? "polygon(0 0, 100% 0, 50% 100%)"
              : beak === "left"
                ? "polygon(100% 0, 100% 100%, 0 50%)"
                : "polygon(0 0, 0 100%, 100% 50%)",
        }}
        aria-hidden
      />
    </span>
  );
}

/**
 * Where a control's caption sits: standing on the pill's top edge, with only
 * its beak crossing into the pill to point at the control below.
 *
 * The caption starts out centred on the control (see {@link PillButton}), so
 * the lift is its own half height, which puts its bottom edge on the control's
 * centre, plus half the pill's `h-11` row to carry that edge up to the row's
 * top. 22px is the one number the caption and the row share, and it holds at
 * every avatar size: the whole surface is drawn scaled, so both are in the
 * same units.
 *
 * Not further up. Growing downward the canvas keeps only its own pad above the
 * pill, which a caption standing here clears by around 7px, and one lifted
 * clear of the pill's edge would be cut off by the top of the window.
 */
const CONTROL_CAPTION_LIFT = "-translate-y-[calc(50%+22px)]";

/**
 * Where a control's caption sits on a column: standing off the column's edge,
 * with only its beak crossing into it to point at the control beside it.
 *
 * The same 22px, read across: the column is the row stood up, so its half
 * width is the row's half height, and the caption's own half width carries
 * its near edge to the column's edge the way its half height carries its
 * bottom edge to the row's top. Toward the middle of the screen, since a
 * column stands against a side of the display and the other way is off it.
 */
const CONTROL_CAPTION_BESIDE: Record<
  Exclude<CompanionCaptionSide, "above">,
  string
> = {
  right: "translate-x-[calc(50%+22px)]",
  left: "-translate-x-[calc(50%+22px)]",
};

/** The way a caption stands off its control, by which side it stands on. */
const captionStance = (
  side: CompanionCaptionSide,
): { className: string; beak: "down" | "left" | "right" } =>
  side === "above"
    ? { className: CONTROL_CAPTION_LIFT, beak: "down" }
    : {
        className: CONTROL_CAPTION_BESIDE[side],
        beak: side === "right" ? "left" : "right",
      };

export const useCompanionCaptionStance = (): {
  className: string;
  beak: "down" | "left" | "right";
} => captionStance(useContext(CaptionSideContext));

/**
 * A control in the pill.
 *
 * `label` is always the accessible name. It is drawn in the row only when the
 * pill has room for words (`showLabel`); everywhere else the control is an
 * icon with its name in a {@link Caption} above it, the way the Dock names an
 * icon under the pointer, so the call's controls are icon-only without being
 * unlabelled and the pill is one width whatever the pointer is doing.
 *
 * **The caption is `:hover`, deliberately, and this is the one place on the
 * surface where that is not a matter of taste.** The host's window is
 * click-through, so the page derives its own hover by hit-testing coordinates
 * against the pill on every forwarded mouse-move rather than trusting
 * `mouseenter` (`companion-surface-page.tsx`). A per-control reveal driven off
 * React's mouse events would be betting on the events that page does not
 * receive. The held-down background on this very button runs on `:hover`, so
 * a caption on the same mechanism works exactly where the rest of the control
 * does.
 *
 * **The caption escapes the row's clipping by having a different containing
 * block.** The row hides its overflow so nothing is drawn past the pill while
 * the width catches up with the content, and a caption standing above the row
 * is exactly that overflow. Overflow clips only what the clipping box
 * contains, so the caption is positioned against the row's parent instead:
 * this button is not positioned and neither is the row, and with no offsets
 * of its own the caption takes its static position, which for the child of a
 * flex container is where it would sit as the sole item. `justify-center` and
 * `items-center` put that on the control's centre, and from there the caption
 * lifts by {@link CONTROL_CAPTION_LIFT}. Nothing measures anything.
 *
 * `pressed` is the control's own on or off, which is a state: a button
 * reporting a state it does not have is one assistive technology describes
 * wrongly, so it is undefined for everything that does not toggle, which is
 * most of this surface. Where it is set it draws the held-down look as well,
 * so the state a looking user reads off the background and the state a reader
 * is told cannot come apart.
 */
export function PillButton({
  icon,
  label,
  shortcut,
  tone,
  showLabel = false,
  pressed,
  spotlit = false,
  dimmed = false,
  control,
  narrow = false,
  className = "",
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** The key that makes the same press, written into the caption after the name. */
  shortcut?: string;
  tone?: "positive" | "negative";
  showLabel?: boolean;
  pressed?: boolean;
  /**
   * Drawn as the control in use, for the beat of the introduction that is
   * about it: the same held-down look a press gives it, with no pointer on it.
   * See {@link CompanionSurfaceSpotlight}.
   */
  spotlit?: boolean;
  /**
   * Stood down, because the introduction is describing a different control.
   * Every other control on the row dims rather than staying at full strength,
   * so the one being described is the only live thing on the bar.
   */
  dimmed?: boolean;
  /**
   * Which control this is, in the introduction's vocabulary, written onto the
   * element as `data-control`. The introduction's card finds it there to aim
   * its beak at, which is a measurement rather than a layout the card could
   * derive: this row's controls come and go with the session's state.
   */
  control?: CompanionSurfaceSpotlight;
  /** Drawn to its icon's width, for a chevron riding beside another control. */
  narrow?: boolean;
  /** A name for the stylesheet, for a control something else is placed against. */
  className?: string;
  onClick?: () => void;
}) {
  const stance = useCompanionCaptionStance();
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-control={control}
      onClick={onClick}
      // A press on a control is not the start of a drag. Without this the
      // surface would move under a click meant to activate something on it.
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      className={`group flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full text-[12px] transition-[background-color,opacity] duration-200 hover:bg-white/15 ${
        narrow ? "-mx-1 px-0.5" : "px-2"
      } ${className} ${
        pressed === true || spotlit ? "bg-white/15" : ""
      } ${dimmed ? "opacity-35" : ""} ${
        tone === "negative"
          ? "text-[#ff6b6b]"
          : tone === "positive"
            ? "text-[#5ee08a]"
            : "text-white/85"
      }`}
    >
      {icon}
      {showLabel ? (
        <span>{label}</span>
      ) : (
        // `data-label` is the caption's contract, and it is here because the
        // behaviour itself is a stylesheet: a test running without Tailwind
        // sees a span either way, so the attribute is the only honest way to
        // hold that this word is hidden until the pointer arrives.
        <Caption
          label={label}
          shortcut={shortcut}
          className={`opacity-0 group-hover:opacity-100 ${stance.className}`}
          beak={stance.beak}
          data-label="hover"
        />
      )}
    </button>
  );
}
