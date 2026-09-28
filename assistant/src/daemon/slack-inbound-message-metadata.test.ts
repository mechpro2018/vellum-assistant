import { describe, expect, test } from "bun:test";

import { SlackInboundMessageMetadataSchema } from "./slack-inbound-message-metadata.js";

describe("SlackInboundMessageMetadataSchema", () => {
  test("keeps required replay fields and valid app context", () => {
    const parsed = SlackInboundMessageMetadataSchema.parse({
      channelId: "C0123ABC",
      channelTs: "1700000000.000100",
      appContext: {
        entities: [{ type: "slack#/types/channel_id", value: "C0456DEF" }],
      },
    });

    expect(parsed.channelId).toBe("C0123ABC");
    expect(parsed.appContext?.entities).toHaveLength(1);
  });

  test("rejects missing required replay fields and drops malformed optionals", () => {
    expect(
      SlackInboundMessageMetadataSchema.safeParse({ channelId: "C0123ABC" })
        .success,
    ).toBe(false);

    const parsed = SlackInboundMessageMetadataSchema.parse({
      channelId: "C0123ABC",
      channelTs: "1700000000.000100",
      actorTimezoneOffsetSeconds: "3600",
      appContext: { entities: [null, { type: 42, value: "bad" }] },
    });
    expect(parsed.actorTimezoneOffsetSeconds).toBeUndefined();
    expect(parsed.appContext?.entities).toEqual([]);
  });
});
