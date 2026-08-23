import { prisma } from "../db.js";
import { inngest } from "../inngest/index.js";

// Create task
export const createTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const {
      projectId,
      title,
      description,
      type,
      status,
      priority,
      assigneeId,
      dueDate,
    } = req.body;
    const origin = req.get("origin");

    //check if user has admin role in the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({
        message: "You are not authorized to create a task in this project",
      });
    } else if (
      assigneeId &&
      !project.members.find((member) => member.user.id === assigneeId)
    ) {
      return res
        .status(403)
        .json({ message: "Assignee is not a member of this project" });
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        priority,
        assigneeId,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    const taskWithAssignee = await prisma.task.findUnique({
      where: { id: task.id },
      include: { assignee: true },
    });

    await inngest.send({
      name: "app/task.assigned",
      data: {
        taskId: task.id,
        origin,
      },
    });
    res
      .status(201)
      .json({ task: taskWithAssignee, message: "Task created successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message || error.code || "Internal Server Error",
    });
  }
};

// Update task
export const updateTask = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    const { userId } = await req.auth();

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({
        message: "You are not authorized to create a task in this project",
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res
      .status(201)
      .json({ task: updatedTask, message: "Task updated successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message || error.code || "Internal Server Error",
    });
  }
};

// Delete task
export const deleteTask = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { taskIds } = req.body;

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
    });

    if (tasks.length === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await prisma.project.findUnique({
      where: { id: tasks[0].projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    } else if (project.team_lead !== userId) {
      return res.status(403).json({
        message: "You are not authorized to create a task in this project",
      });
    }

    await prisma.task.deleteMany({
      where: { id: { in: taskIds } },
    });
    res.status(201).json({ message: "Tasks deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: error.message || error.code || "Internal Server Error",
    });
  }
};
