import { describe, expect, test } from "bun:test";

import { decodeDecisionToken, mintDecisionToken } from "./decision-token.js";

function tokenFor(payload: unknown): string {
  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.nonce`;
}

describe("decision token parsing", () => {
  test("round-trips a minted token", () => {
    const decoded = decodeDecisionToken(
      mintDecisionToken({
        conversationId: "conversation-1",
        surfaceId: "surface-1",
        action: "confirm",
      }),
    );

    expect(decoded).toMatchObject({
      conversationId: "conversation-1",
      surfaceId: "surface-1",
      action: "confirm",
    });
  });

  test("rejects structurally invalid payloads", () => {
    expect(
      decodeDecisionToken(
        tokenFor({
          conversationId: "conversation-1",
          surfaceId: 42,
          action: "confirm",
          issuedAt: "2026-09-28T00:00:00.000Z",
          expiresAt: "2026-09-28T00:05:00.000Z",
        }),
      ),
    ).toBeNull();
  });
});
