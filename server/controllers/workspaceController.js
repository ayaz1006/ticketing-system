import { prisma } from "../db.js";

// Get all workspaces for users
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: userId } },
      },
      include: {
        members: { include: { user: true } },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: { include: { user: true } },
              },
            },
            members: { include: { user: true } },
          },
        },
        owner: true,
      },
    });
    res.status(200).json(workspaces);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    res.status(500).json({
      message: error.code || error.message || "Internal server error",
    });
  }
};

//Add a member to a workspace
export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    // check if user exits
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!role || !workspaceId) {
      return res
        .status(400)
        .json({ message: "Role and workspaceId are required." });
    }

    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res
        .status(400)
        .json({ message: "Invalid role. Must be either 'ADMIN' or 'MEMBER'." });
    }

    //fetch workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found." });
    }
    // Check if the user is an admin of the workspace
    const isAdmin = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspaceId,
        userId: userId,
        role: "ADMIN",
      },
    });

    if (!isAdmin) {
      return res.status(403).json({
        message: "You are not authorized to add members to this workspace.",
      });
    }

    // Check if the user is already a member of the workspace
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspaceId,
        userId: user.id,
      },
    });

    if (existingMember) {
      return res
        .status(400)
        .json({ message: "User is already a member of this workspace." });
    }

    // Add the new member to the workspace
    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
        message,
      },
    });

    res.status(201).json({ newMember, message: "Member added successfully." });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({
      message: error.code || error.message || "Internal server error",
    });
  }
};
