import { z } from "zod";
import { getAccountStatus as fetchAccountStatus } from "../api-client.js";

export const getAccountStatusSchema = z.object({});

export async function getAccountStatus(apiKey: string) {
  const status = await fetchAccountStatus(apiKey);

  if (status.error) {
    return {
      content: [
        {
          type: "text" as const,
          text: status.error,
        },
      ],
      isError: true,
    };
  }

  const lines = [
    `**SciWeave Account Status**`,
    ``,
    `Credits remaining: **${status.balance}**`,
  ];

  if (status.balance <= 0) {
    lines.push(
      ``,
      `You're out of credits. Purchase more to continue using SciWeave tools.`,
      ``,
      `Top up here: ${status.topUpUrl}`,
      `View pricing: ${status.pricingUrl}`
    );
  } else if (status.balance <= 10) {
    lines.push(
      ``,
      `Running low on credits. Consider topping up soon.`,
      ``,
      `Top up here: ${status.topUpUrl}`,
      `View pricing: ${status.pricingUrl}`
    );
  } else {
    lines.push(
      ``,
      `Manage your account: ${status.topUpUrl}`,
      `View pricing: ${status.pricingUrl}`
    );
  }

  return {
    content: [
      {
        type: "text" as const,
        text: lines.join("\n"),
      },
    ],
  };
}
