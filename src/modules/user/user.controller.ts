import { Request, Response } from "express";
import { UserModel } from "./user.model";
import { NewsLetterModel } from "./newletter.model";
import { deleteUserAndData, reauthenticate, ReauthenticationError } from "./user.service";



export async function getProfile(req: any, res: Response) {

    const user = await UserModel.findOne({ _id: req.user.userId }).select("-updatedAt")

    res.json({ user });
}

// DELETE /user/me — irreversible. Requires authGuard (identity) AND a fresh
// re-auth proof in the body (ownership), because the 7-day JWT alone has no
// revocation list. Removes the account and every collection keyed to its
// userId; see user.service.ts for exactly what is and isn't cascaded.
export async function deleteAccount(req: any, res: Response) {
    try {
        const user = await UserModel.findById(req.user.userId).select("+password");
        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }

        try {
            await reauthenticate(user, req.body);
        } catch (err) {
            if (err instanceof ReauthenticationError) {
                return res.status(401).json({ message: err.message });
            }
            throw err;
        }

        await deleteUserAndData(user._id.toString());

        // The client's session is now meaningless — drop the cookie the same
        // way logout does (the app's own copy is cleared client-side).
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });

        res.json({ success: true, message: "Account deleted" });
    } catch (err) {
        console.error("deleteAccount failed:", err);
        res.status(500).json({ message: "Failed to delete account" });
    }
}




export async function newsLetter(req: any, res: Response) {
    const { email } = req.body
    const result = await NewsLetterModel.findOne({ email })



    if (result) {
        return res.json({ message: "Already subscribe" });
    }
    await NewsLetterModel.create({
        email
    })

    res.json({ message: "You will get all our updates" });

}
