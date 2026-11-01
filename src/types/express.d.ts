
import { IUser } from "../modules/user/user.model"; // adjust path to your User type/interface

declare global {
  namespace Express {
    interface Request {
      user: {
        userId: string;
        role: string;
      } // or whatever your user type is

      /**
       * Set by identifyUser (app-wide, before globalLimiter) purely so the rate
       * limiter can bucket per user instead of per IP. Verified but NOT
       * authorised — never treat its presence as proof of access. Use `user`,
       * which authGuard sets after checking the account is still active.
       */
      authUserId?: string;
    }
  }
}