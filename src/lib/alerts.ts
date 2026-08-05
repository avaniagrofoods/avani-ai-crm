const SLACK_WEBHOOK_URL = process.env.SLACK_ALERTS_WEBHOOK_URL;
const CRM_APP_URL = "https://avani-ai-crm.vercel.app";

/**
 * Dispatches an urgent incident payload to your Slack Operations channel
 */
export async function sendSlackAlert(errorMessage: string, componentContext: string, clientPhone: string = "N/A") {
  if (!SLACK_WEBHOOK_URL) {
    console.error("Slack webhook configuration URL is missing from environment layout properties.");
    return;
  }

  const alertPayload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚨 CRITICAL: CRM DATABASE CONNECTION FAILURE",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Environment:* \`Production (Vercel)\`` },
          { type: "mrkdwn", text: `*Application:* \`Avani AI CRM\`` },
          { type: "mrkdwn", text: `*Component Context:* \`${componentContext}\`` },
          { type: "mrkdwn", text: `*Impacted Lead Phone:* \`${clientPhone}\`` }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Details:*\n\`\`\`${errorMessage}\`\`\``
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open CRM Dashboard" },
            url: CRM_APP_URL,
            style: "primary"
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Check Vercel Deployment Logs" },
            url: "https://vercel.com"
          }
        ]
      }
    ]
  };

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertPayload)
    });
  } catch (slackError) {
    console.error("Failed to route incident notification back to Slack channel pipeline:", slackError);
  }
}
