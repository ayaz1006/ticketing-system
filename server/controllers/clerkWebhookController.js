import { Webhook } from "standardwebhooks";
import { inngest } from "../inngest/index.js";

export const handleClerkWebhook = async (req, res) => {
  try {
    const webhook = new Webhook(process.env.CLER_WEBHOOK_SECRET);
    const event = webhook.verify(req.body.toString("utf8"), req.headers);

    await inngest.send({
      name: `clerk/${event.type}`,
      data: event.data,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Clerk webhook:", error);
    res.status(400).json({ message: "Invalid Clerk webhook" });
  }
};
