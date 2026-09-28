/**
 * OpenAI Codex device-code authorization.
 *
 * OpenAI's Codex sign-in uses a bespoke device-authorization API rather than
 * RFC 8628. The daemon asks for a short user code, the user types it at
 * `https://auth.openai.com/codex/device`, and the poll endpoint answers with an
 * OAuth authorization code plus the PKCE pair minted alongside it. The caller
 * exchanges that pair at the normal token endpoint, so the resulting tokens are
 * identical to the browser redirect flow's.
 *
 * The account must have "Enable device code authorization for Codex" turned on
 * in ChatGPT security settings. When it is off the poll never succeeds: it
 * either stays pending until the code expires or answers with a distinct error
 * code, both of which surface as a `DeviceAuthError`.
 */

import { z } from "zod";

import { getLogger } from "../util/logger.js";
import type { OAuth2Config, OAuth2FlowResult } from "./oauth2.js";
import { exchangeCodeForTokens } from "./oauth2.js";

const log = getLogger("openai-device-auth");

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const OPENAI_DEVICE_AUTH_USERCODE_URL =
  "https://auth.openai.com/api/accounts/deviceauth/usercode";

export const OPENAI_DEVICE_AUTH_TOKEN_URL =
  "https://auth.openai.com/api/accounts/deviceauth/token";

/** Page where the user types the short code. */
export const OPENAI_DEVICE_VERIFICATION_URL =
  "https://auth.openai.com/codex/device";

/** Redirect URI the device-issued authorization code is bound to. */
export const OPENAI_DEVICE_REDIRECT_URI =
  "https://auth.openai.com/deviceauth/callback";

/** Fallback poll interval when the server omits or garbles `interval`. */
const DEFAULT_POLL_INTERVAL_SECONDS = 5;

/** Hard ceiling on a device authorization, regardless of `expires_at`. */
export const OPENAI_DEVICE_AUTH_MAX_LIFETIME_MS = 15 * 60 * 1000;

/** Error code the poll endpoint returns while the user has not yet approved. */
const AUTHORIZATION_PENDING_CODE = "deviceauth_authorization_pending";

const DeviceCodeResponseSchema = z
  .object({
    device_auth_id: z.string().min(1),
    user_code: z.string().min(1),
    expires_at: z.string().min(1).optional().catch(undefined),
    interval: z.unknown().transform(parseIntervalSeconds),
  })
  .passthrough();

const DeviceAuthorizationResponseSchema = z
  .object({
    authorization_code: z.string().min(1),
    code_verifier: z.string().min(1),
    code_challenge: z.string().min(1).optional().catch(undefined),
  })
  .passthrough();

const DeviceAuthErrorResponseSchema = z
  .object({
    error: z
      .union([
        z.string().min(1),
        z
          .object({
            code: z.string().min(1).optional().catch(undefined),
            message: z.string().min(1).optional().catch(undefined),
          })
          .passthrough(),
      ])
      .optional()
      .catch(undefined),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export class DeviceAuthError extends Error {
  /**
   * Machine-readable failure code: the provider's `error.code` when it sends
   * one, otherwise a locally assigned code (`expired_token`, `request_failed`,
   * `aborted`).
   */
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DeviceAuthError";
    this.code = code;
  }
}

/** A minted device authorization, before the user has approved it. */
export interface DeviceAuthRequest {
  deviceAuthId: string;
  /** Short code the user types at `verificationUrl`. */
  userCode: string;
  verificationUrl: string;
  /** ISO-8601 instant after which the code stops being accepted. */
  expiresAt: string;
  intervalSeconds: number;
}

/** The PKCE-bound authorization code the poll endpoint hands back. */
export interface DeviceAuthCode {
  authorizationCode: string;
  codeVerifier: string;
  codeChallenge?: string;
}

export interface DeviceAuthOptions {
  /** Injectable `fetch`, for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable delay between polls, for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable clock, for tests. */
  now?: () => number;
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Step 1: mint a user code
// ---------------------------------------------------------------------------

export async function requestDeviceCode(
  clientId: string,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthRequest> {
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(OPENAI_DEVICE_AUTH_USERCODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ client_id: clientId }),
      signal: options.signal,
    });
  } catch (err) {
    throw new DeviceAuthError(
      `Could not reach the device authorization endpoint: ${errorMessage(err)}`,
      "request_failed",
    );
  }

  if (!response.ok) {
    const { code, message } = await readErrorBody(response);
    throw new DeviceAuthError(
      message ??
        `Device authorization request failed (HTTP ${response.status})`,
      code ?? "request_failed",
    );
  }

  const parsed = DeviceCodeResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new DeviceAuthError(
      "Device authorization response is missing a device id or user code.",
      "request_failed",
    );
  }

  return {
    deviceAuthId: parsed.data.device_auth_id,
    userCode: parsed.data.user_code,
    verificationUrl: OPENAI_DEVICE_VERIFICATION_URL,
    expiresAt:
      parsed.data.expires_at ??
      new Date(
        (options.now?.() ?? Date.now()) + OPENAI_DEVICE_AUTH_MAX_LIFETIME_MS,
      ).toISOString(),
    intervalSeconds: parsed.data.interval,
  };
}

// ---------------------------------------------------------------------------
// Step 2: poll until the user approves
// ---------------------------------------------------------------------------

/**
 * Poll until the user approves the code, the code expires, or the provider
 * reports a non-pending failure.
 *
 * The poll answers 403 (and occasionally 404) while approval is outstanding, so
 * those statuses are only fatal when the body names an error code other than
 * `deviceauth_authorization_pending`. Transport failures and 5xx/429 responses
 * are retried until the deadline.
 */
export async function pollForAuthorizationCode(
  request: DeviceAuthRequest,
  options: DeviceAuthOptions = {},
): Promise<DeviceAuthCode> {
  const doFetch = options.fetchImpl ?? fetch;
  const doSleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());

  const intervalMs = request.intervalSeconds * 1000;
  const deadline = resolveDeadline(request.expiresAt, now());

  while (now() < deadline) {
    assertNotAborted(options.signal);

    let response: Response | undefined;
    try {
      response = await doFetch(OPENAI_DEVICE_AUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          device_auth_id: request.deviceAuthId,
          user_code: request.userCode,
        }),
        signal: options.signal,
      });
    } catch (err) {
      assertNotAborted(options.signal);
      log.warn({ err: errorMessage(err) }, "Device auth poll failed, retrying");
    }

    if (response?.ok) {
      const parsed = DeviceAuthorizationResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        throw new DeviceAuthError(
          "Device authorization succeeded but returned no authorization code.",
          "request_failed",
        );
      }
      log.info("OpenAI device authorization approved");
      return {
        authorizationCode: parsed.data.authorization_code,
        codeVerifier: parsed.data.code_verifier,
        ...(parsed.data.code_challenge
          ? { codeChallenge: parsed.data.code_challenge }
          : {}),
      };
    }

    if (response && !isRetryableStatus(response.status)) {
      const { code, message } = await readErrorBody(response);
      // A pending approval answers 403/404 with the pending code; anything else
      // is terminal, including the error raised when device-code authorization
      // is disabled for the account.
      if (code !== AUTHORIZATION_PENDING_CODE && (code || message)) {
        throw new DeviceAuthError(
          message ?? `Device authorization failed (HTTP ${response.status})`,
          code ?? "request_failed",
        );
      }
    }

    await doSleep(intervalMs);
  }

  assertNotAborted(options.signal);
  throw new DeviceAuthError(
    "The device code expired before the sign-in was approved.",
    "expired_token",
  );
}

// ---------------------------------------------------------------------------
// Step 3: exchange the authorization code
// ---------------------------------------------------------------------------

/**
 * Run steps 2 and 3: wait for approval, then exchange the device-issued
 * authorization code and its PKCE verifier for OAuth tokens.
 *
 * The signal reaches the exchange too, and is checked once more after it
 * returns: a cancellation that lands while the tokens are in flight must not
 * hand the caller a set of credentials to store.
 */
export async function completeDeviceAuth(
  config: OAuth2Config,
  request: DeviceAuthRequest,
  options: DeviceAuthOptions = {},
): Promise<OAuth2FlowResult> {
  const { authorizationCode, codeVerifier } = await pollForAuthorizationCode(
    request,
    options,
  );

  const result = await exchangeCodeForTokens(
    config,
    authorizationCode,
    OPENAI_DEVICE_REDIRECT_URI,
    codeVerifier,
    undefined,
    { signal: options.signal },
  );
  assertNotAborted(options.signal);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `interval` arrives as a string of seconds; fall back when it is unusable. */
function parseIntervalSeconds(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_POLL_INTERVAL_SECONDS;
  }
  return parsed;
}

/** Stop at `expires_at`, never later than the hard lifetime ceiling. */
function resolveDeadline(expiresAt: string, startedAt: number): number {
  const ceiling = startedAt + OPENAI_DEVICE_AUTH_MAX_LIFETIME_MS;
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) {
    return ceiling;
  }
  return Math.min(parsed, ceiling);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Pull `{ error: { code, message } }` off a failure body. Both fields are
 * optional: an unparseable body reads as a transient failure so the caller
 * keeps polling.
 */
async function readErrorBody(
  response: Response,
): Promise<{ code?: string; message?: string }> {
  const raw = await response.text().catch(() => "");
  if (!raw) {
    return {};
  }
  try {
    const parsed = DeviceAuthErrorResponseSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.error === undefined) {
      return {};
    }
    if (typeof parsed.data.error === "string") {
      return { code: parsed.data.error };
    }
    return {
      ...(parsed.data.error.code ? { code: parsed.data.error.code } : {}),
      ...(parsed.data.error.message
        ? { message: parsed.data.error.message }
        : {}),
    };
  } catch {
    return {};
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DeviceAuthError("Device authorization was cancelled.", "aborted");
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof timer === "object" && "unref" in timer) {
      timer.unref();
    }
  });
}
