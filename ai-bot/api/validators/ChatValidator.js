import { z } from "zod";

export const ChatSchema = z
  .object({
    sessionId: z.string().optional(),

    /*
     * -----------------------------------------------------
     * User Message
     * -----------------------------------------------------
     * Optional because action-driven requests
     * do not require text.
     */

    message: z.string().trim().optional().default(""),

    /*
     * -----------------------------------------------------
     * UI Action
     * -----------------------------------------------------
     */

    action: z
      .object({
        id: z.string().min(1),

        label: z.string().optional(),

        payload: z.object({}).passthrough().optional(),
      })
      .nullable()
      .optional(),

    /*
     * -----------------------------------------------------
     * Customer
     * -----------------------------------------------------
     */

    customer: z
      .object({
        id: z.string().optional(),

        name: z.string().optional(),

        email: z.string().email().optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasMessage = data.message && data.message.trim().length > 0;

    const hasAction = !!data.action?.id;

    if (!hasMessage && !hasAction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["message"],
        message: "Either a message or an action is required.",
      });
    }
  });
