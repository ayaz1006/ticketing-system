import { prisma } from "../db.js";

// Add Comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, taskId } = req.body;

    // check if user is project member

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { member: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.members.find((member) => member.userId === userId);
    if (!member) {
      return res
        .status(403)
        .json({ message: "You are not authorized to comment on this task" });
    }

    const comment = await prisma.comment.create({
      data: { taskId, content, userId },
      include: { user: true },
    });
    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({
      message: error.message || error.code || "Internal Server Error",
    });
  }
};

// Get Comments for task
export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findmany({
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
