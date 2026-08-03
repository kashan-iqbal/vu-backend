import { Request, Response } from "express";
import * as adminService from "./admin.service";

export async function getOverview(_req: Request, res: Response) {
  try {
    res.json(await adminService.getOverviewStats());
  } catch (error) {
    console.error("admin getOverview error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    res.json(await adminService.listUsers(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getUsers error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function patchUserStatus(req: Request, res: Response) {
  try {
    const user = await adminService.setUserActiveStatus(req.params.id, req.body.isActive);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (error) {
    console.error("admin patchUserStatus error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getContributions(req: Request, res: Response) {
  try {
    res.json(await adminService.listContributions(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getContributions error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function approveContribution(req: Request, res: Response) {
  try {
    const contribution = await adminService.approveContribution(req.params.id);
    if (!contribution) return res.status(404).json({ message: "Contribution not found" });
    res.json({ contribution });
  } catch (error) {
    console.error("admin approveContribution error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function rejectContribution(req: Request, res: Response) {
  try {
    const contribution = await adminService.rejectContribution(req.params.id);
    if (!contribution) return res.status(404).json({ message: "Contribution not found" });
    res.json({ contribution });
  } catch (error) {
    console.error("admin rejectContribution error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getContributors(req: Request, res: Response) {
  try {
    res.json(await adminService.listContributors(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getContributors error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getContributorDetail(req: Request, res: Response) {
  try {
    res.json(await adminService.getContributorDetail(req.params.phone));
  } catch (error) {
    console.error("admin getContributorDetail error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getHandouts(req: Request, res: Response) {
  try {
    res.json(await adminService.listHandoutsAdmin(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getHandouts error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getPastMcqs(req: Request, res: Response) {
  try {
    res.json(await adminService.listPastMcqs(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getPastMcqs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAiMcqs(req: Request, res: Response) {
  try {
    res.json(await adminService.listAiMcqs(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getAiMcqs error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getWrongAnswers(req: Request, res: Response) {
  try {
    res.json(await adminService.listWrongAnswers(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getWrongAnswers error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getFeedback(req: Request, res: Response) {
  try {
    res.json(await adminService.listFeedback(req.query as Record<string, unknown>));
  } catch (error) {
    console.error("admin getFeedback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
