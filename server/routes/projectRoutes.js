import express from "express";
import {
  createProject,
  updateProject,
  addMemberToProject,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

projectRouter.post("/", createProject);
projectRouter.put("/:id", updateProject);
projectRouter.post("/:projectId/addMember", addMemberToProject);

export default projectRouter;
