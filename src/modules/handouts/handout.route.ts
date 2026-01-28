import {Router} from "express"
import { createHandoutsController, getSingleHandout } from "./handout.controller"






export const handoutRouter = Router()



handoutRouter.post("/", createHandoutsController)




handoutRouter.get("/:id", getSingleHandout)