import express from "express";
import { handleClerkWebhook } from "../controllers/clerkWebhookController.js";

const clerkWebhookRouter = express.Router();

clerkWebhookRouter.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  handleClerkWebhook,
);

export default clerkWebhookRouter;
