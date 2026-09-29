import { useReducedMotion } from "motion/react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from "react";

import type { CompanionCharacter } from "@vellumai/ipc-contract";

import { AnimatedAvatar } from "@/components/avatar/animated-avatar";
import { CompanionPeek } from "@/components/companion-peek";
import { BUNDLED_COMPONENTS } from "@/utils/avatar-bundled-components";

/**
 * The avatar, which is the point the whole surface is arranged around.
 *
 * Positioned on the point the host put the window around rather than laid out
 * in the pill, which is what lets the pill change width and shape underneath
 * without the creature moving a pixel.
 *
 * No light behind the creature. It once sat on a blurred disc of its own
 * accent, and the halo went because it made the creature read as a lit control
 * rather than as something standing on the desktop.
 *
 * **The bob is a wrapper, not a class on the artwork.** `AnimatedAvatar` owns
 * `transform` on its own `<svg>` for the breathe and the morph, and a second
 * animation on that node would silently replace one of them. Everything that
 * belongs to the creature rides inside the wrapper. The edge sits outside it: it is
 * drawn on the shape rather than on the artwork, so a ring saying something is
 * running holds still while the creature breathes under it.
 *
 * **The collapse is a third node, for the same reason.** Fading and shrinking
 * the creature away at rest is a `transform`, and putting it on the bob would
 * silently drop the bob. So the collapse gets a wrapper of its own around the
 * bob, and the two animations stay on separate nodes.
 */
export function Avatar({
  accentHex,
  avatarSrc,
  character,
  busy = false,
  attentive = false,
  collapsed = false,
  restingScale = 1,
  label,
  avatarImageSize,
  peekCapsule,
  style,
  elementRef,
  onPointerDown,
  onContextMenu,
  onClick,
}: {
  accentHex: string;
  /** The press's accessible name. See `onAvatarClick` in `CompanionSurface`. */
  label: string;
  avatarImageSize: number;
  peekCapsule: { width: number; height: number };
  avatarSrc?: string;
  character?: CompanionCharacter;
  busy?: boolean;
  attentive?: boolean;
  /**
   * Whether the surface is at rest, where the creature is tucked behind the
   * marker and peeks out of it. See {@link RESTING_PILL}.
   */
  collapsed?: boolean;
  /**
   * What the peek scales by to undo the scale this node already carries, so it
   * rides a marker drawn at one size whatever the creature is sized to.
   * Applies to the peek alone: the standing creature is its own box and grows
   * with it, which is the whole point of the setting.
   */
  restingScale?: number;
  style?: CSSProperties;
  elementRef?: Ref<HTMLDivElement>;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}) {
  // Belt and braces alongside the `prefers-reduced-motion` block beside the
  // keyframes: the class is what a stylesheet-only reader sees, this is what a
  // reader of the component sees.
  const reduce = useReducedMotion();

  return (
    // A div rather than a button even when it is pressable: it is the drag
    // handle for the whole surface, and the press that starts a drag must not
    // read as activating a control. `onClick` fires only for presses the caller
    // decided were not drags.
    <div
      role="button"
      aria-label={label}
      className="absolute grid size-11 cursor-grab place-items-center active:cursor-grabbing"
      style={style}
      ref={elementRef}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onClick={onClick}
    >
      {/* Once in a while the creature looks out of the marker: it rises from
        behind the top or bottom edge far enough to show its eyes, holds a
        moment, and ducks back; see `CompanionPeek`. Only for a composed
        creature: a custom image has nobody to peek.

        The pill it rises over is hollow, which costs the peek nothing: the
        rise is drawn through a clip that shows only the slice above the rim,
        so what hides the rest of the creature is the clip and never a fill.

        Rides the marker's own scale and fade, so it is drawn at the marker's
        one size on every setting and goes with it when the creature comes out
        for real. */}
      {character !== undefined ? (
        <CompanionPeek
          character={character}
          capsule={peekCapsule}
          // A working creature holds a focused pose, and stops blinking for the
          // same reason. The creature is carrying the state; nothing else
          // should.
          enabled={collapsed && !busy}
          className="absolute top-1/2 left-1/2 transition-opacity duration-200"
          style={{
            transform: `translate(-50%, -50%) scale(${restingScale})`,
            opacity: collapsed ? 1 : 0,
          }}
        />
      ) : null}
      {/* The creature standing up out of the marker. A wrapper of its own
        because the scale is a `transform` and the bob below already owns
        one. */}
      <div
        className="transition-[opacity,transform] duration-300"
        style={{
          opacity: collapsed ? 0 : 1,
          transform: collapsed ? "scale(0.35)" : "scale(1)",
          transitionTimingFunction: "cubic-bezier(.2,.8,.2,1)",
          // The scale is dropped for a reader who asked for stillness and the
          // fade is kept: a cross-fade is not motion across the screen, and it
          // is gentler than the creature snapping in and out.
          transitionProperty: reduce ? "opacity" : undefined,
        }}
      >
        <div
          className="companion-avatar-bob relative grid place-items-center"
          style={{ animation: reduce ? "none" : undefined }}
        >
          {character !== undefined ? (
            // The live creature, composed here rather than shipped as pixels. It
            // blinks, twitches and breathes on its own, which is the whole reason
            // the traits cross the bridge instead of a still.
            <div className="relative drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]">
              <AnimatedAvatar
                components={BUNDLED_COMPONENTS}
                traits={character}
                size={avatarImageSize}
                isAssistantBusy={busy}
                attentive={attentive}
              />
            </div>
          ) : avatarSrc === undefined ? (
            // Until the avatar resolves, a disc in its colour. Same size, so
            // nothing about the geometry moves when the image lands.
            <span
              className="relative size-7 rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
              style={{ background: accentHex }}
              aria-hidden
            />
          ) : (
            // A custom uploaded image, which has no traits to compose and so no
            // eyes to animate.
            //
            // Undraggable, because the avatar is the surface's drag handle. An
            // image is natively draggable, and the platform's own HTML5 image drag
            // takes the pointer and ends the `mousemove` stream the surface's drag
            // runs on, so pressing a custom avatar would move nothing where
            // pressing a composed creature moves the window. WebKit honours the CSS
            // on paths where it ignores the attribute, so both are needed.
            <img
              src={avatarSrc}
              alt=""
              draggable={false}
              className="relative size-7 rounded-full object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] [-webkit-user-drag:none]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
