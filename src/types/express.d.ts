
import { IUser } from "../modules/user/user.model"; // adjust path to your User type/interface

declare global {
  namespace Express {
    interface Request {
      user: {
        userId: string;
        role: string;
      } // or whatever your user type is
    }
  }
}