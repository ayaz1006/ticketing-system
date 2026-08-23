import { prisma } from "../db.js";

// Add Comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, taskId } = req.body;

    // Find task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Find project and its members
    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    // Check if current user is a project member
    const member = project.members.find((member) => member.userId === userId);

    if (!member) {
      return res.status(403).json({
        message: "You are not authorized to comment on this task",
      });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        taskId,
        content,
        userId,
      },
      include: {
        user: true,
      },
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

// Get Comments for task
export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: true },
    });
    res.json({ comments });
  } catch (error) {
    res.status(500).json({
      message:
        error.message || error.code || error.message || "Internal Server Error",
    });
  }
};
