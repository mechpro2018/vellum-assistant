import { z } from "zod";

const SlackMessageContextValueSchema = z
  .object({
    messageTs: z.string().optional().catch(undefined),
    channelId: z.string().optional().catch(undefined),
  })
  .passthrough();

const SlackAppContextEntitySchema = z
  .object({
    type: z.string(),
    value: z.union([z.string(), SlackMessageContextValueSchema]),
    teamId: z.string().optional().catch(undefined),
    enterpriseId: z.string().optional().catch(undefined),
  })
  .passthrough();

export const SlackAppContextSchema = z.object({
  entities: z.array(z.unknown()).transform((entities) =>
    entities.flatMap((entity) => {
      const parsed = SlackAppContextEntitySchema.safeParse(entity);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
});

export type SlackAppContextEntity = z.infer<typeof SlackAppContextEntitySchema>;
export type SlackAppContext = z.infer<typeof SlackAppContextSchema>;

export const SlackInboundMessageMetadataSchema = z
  .object({
    channelId: z.string(),
    channelName: z.string().optional().catch(undefined),
    channelTs: z.string(),
    threadTs: z.string().optional().catch(undefined),
    displayName: z.string().optional().catch(undefined),
    actorExternalUserId: z.string().optional().catch(undefined),
    actorTeamId: z.string().optional().catch(undefined),
    actorTimezone: z.string().optional().catch(undefined),
    actorTimezoneLabel: z.string().optional().catch(undefined),
    actorTimezoneOffsetSeconds: z.number().optional().catch(undefined),
    timestampTimezone: z.string().optional().catch(undefined),
    timestampTimezoneLabel: z.string().optional().catch(undefined),
    speakerTimezoneLabel: z.string().optional().catch(undefined),
    appContext: SlackAppContextSchema.optional().catch(undefined),
  })
  .passthrough();

export type SlackInboundMessageMetadata = z.infer<
  typeof SlackInboundMessageMetadataSchema
>;
