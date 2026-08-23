import { Inngest } from "inngest";
import { prisma } from "../db.js";
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "ticketing-system" });

// Inngest Function to save user data to a database
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk", triggers: [{ event: "clerk/user.created" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.create({
      data: {
        id: data.id,
        email: data?.email_addresses[0]?.email_address,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  },
);

// Inngest Function to delete user data to a database
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", triggers: [{ event: "clerk/user.deleted" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.delete({
      where: {
        id: data.id,
      },
    });
  },
);

// Inngest Function to update user data to a database
const syncUserUpdationtion = inngest.createFunction(
  { id: "update-user-from-clerk", triggers: [{ event: "clerk/user.updated" }] },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.update({
      where: {
        id: data.id,
      },
      data: {
        email: data?.email_addresses[0]?.email_address,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  },
);

// Inngest Function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.created" }],
  },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });
    //Add creator as Admin of the workspace
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "ADMIN",
      },
    });
  },
);

// Inngest Function to update workspace data in the database
const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "update-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.updated" }],
  },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url,
      },
    });
  },
);

// Inngest Function to delete workspace data in the database
const syncWorkspaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-from-clerk",
    triggers: [{ event: "clerk/organization.deleted" }],
  },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.delete({
      where: {
        id: data.id,
      },
    });
  },
);

// Ingest Function to sync workspace members data in the database
const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: [{ event: "clerk/organizationMembership.created" }],
  },
  async ({ event }) => {
    const { data } = event;
    const userId = data.public_user_data?.user_id || data.user_id;
    const workspaceId = data.organization?.id || data.organization_id;

    if (!userId || !workspaceId) {
      throw new Error(
        "Clerk membership event is missing user or organization data",
      );
    }

    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
      update: {
        role: data.role === "org:admin" ? "ADMIN" : "MEMBER",
      },
      create: {
        userId,
        workspaceId,
        role: data.role === "org:admin" ? "ADMIN" : "MEMBER",
      },
    });
  },
);

// Inngest function to send email on Task Creation
const sendTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-task-assignment-email",
    triggers: [{ event: "task/assignment.assigned" }],
  },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, project: true },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await sendEmail({
      to: task.assignee.email,
      subject: `New Task Assignment: ${task.project.name}`,
      html: `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #1a73e8; margin-top: 0;">New Task Assigned</h2>
      <p style="font-size: 16px; color: #333;">Hi <strong>${task.assignee.name}</strong>,</p>
      <p style="font-size: 14px; color: #555;">You've been assigned a new task in <strong>${task.project.name}</strong>.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #1a73e8; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin: 0 0 8px 0; color: #202124; font-size: 18px;">${task.title}</h3>
        <p style="margin: 0; color: #5f6368; font-size: 14px;">
          <strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}
        </p>
      </div>

      <a href="${origin}" style="display: inline-block; background-color: #1a73e8; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">View Task</a>
    </div>
  `,
    });

    if (
      new Date(task.due_date).toLocaleDateString() !== new Date().toDateString()
    ) {
      const reminderTime = new Date(
        new Date(task.due_date).getTime() - 60 * 60 * 1000,
      );
      await step.sleepUntil("wait-for-reminder", reminderTime);
      // await step.sleepUntil("wait-for-the-new-date", new Date(task.due_date));
      await step.run("check-if-task-is-completed", async () => {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true },
        });

        if (!task) return;

        if (task.status !== "DONE") {
          await step.run("send-task-reminder-mail", async () => {
            await sendEmail({
              to: task.assignee.email,
              subject: `Reminder: ${task.title} - ${task.project.name}`,
              html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        <span style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Reminder</span>
        
        <h2 style="color: #0f172a; margin-top: 12px; margin-bottom: 8px;">Task Due Soon</h2>
        <p style="font-size: 15px; color: #475569; margin-bottom: 20px;">Hi <strong>${task.assignee.name}</strong>, this is a quick reminder about your assigned task in <strong>${task.project.name}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">${task.title}</h3>
          <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px; line-height: 1.5;">${task.description || "No description provided."}</p>
          <div style="font-size: 13px; color: #dc2626; font-weight: 600;">
            Due Date: ${new Date(task.due_date).toLocaleDateString()}
          </div>
        </div>

        <a href="${origin}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">View Task Details</a>
      </div>
    `,
            });
          });
        }
      });
    }
  },
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdationtion,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
  sendTaskAssignmentEmail,
];
