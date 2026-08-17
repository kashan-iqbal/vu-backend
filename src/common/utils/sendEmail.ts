import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { Resend } from "resend";
import ejs from "ejs";
import path from "path";
import fs from "fs";

// Deliver via Resend when it's configured (RESEND_API_KEY + a verified-domain
// EMAIL_FROM), otherwise fall back to the existing SMTP transport. Keeping the
// same sendEmail() signature means every caller (OTP, welcome, PDF relay) is
// unchanged — only the transport underneath swaps.
const resendClient = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

// e.g. EMAIL_FROM=`ExamPrep AI <noreply@vuexamprep.com>` (must be a domain
// verified in your Resend dashboard).
const EMAIL_FROM =
    process.env.EMAIL_FROM || `ExamPrep AI <${process.env.SMTP_USER || ""}>`;

async function sendViaResend(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachments?: Mail.Attachment[],
) {
    const { error } = await resendClient!.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
        attachments: attachments?.map((a) => ({
            filename: String(a.filename ?? "attachment"),
            content: a.content as Buffer | string,
            contentType: a.contentType,
        })),
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
}

async function sendViaSmtp(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachments?: Mail.Attachment[],
) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
        attachments,
    });
}

export async function sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
    attachments?: Mail.Attachment[],
) {
    if (resendClient && process.env.EMAIL_FROM) {
        return sendViaResend(to, subject, text, html, attachments);
    }
    return sendViaSmtp(to, subject, text, html, attachments);
}

// ── Email template rendering ──
// Resolve the templates dir for both dev (ts-node-dev on src/) and prod (dist/).
// First existing candidate wins; build copies the folder into dist (see package.json).
const TEMPLATE_DIR_CANDIDATES = [
    path.join(__dirname, "..", "..", "Email-templates"), // src/ or dist/ Email-templates
    path.join(process.cwd(), "src", "Email-templates"),
    path.join(process.cwd(), "dist", "Email-templates"),
];
const TEMPLATES_DIR =
    TEMPLATE_DIR_CANDIDATES.find((dir) => fs.existsSync(dir)) ?? TEMPLATE_DIR_CANDIDATES[0];

// Brand defaults injected into every template so they stay on-theme with the
// frontend (ExamPrep AI — deep navy + soft teal).
const BRAND = {
    brandName: "ExamPrep AI",
    tagline: "Master Your Exams with Intelligent Preparation",
    primary: "#0F3A7D",
    primaryDark: "#0A2A5C",
    accent: "#4A90A4",
    year: new Date().getFullYear(),
    supportEmail: process.env.SUPPORT_EMAIL || "support@vuexamprep.com",
    appUrl: process.env.FRONTEND_URL || "https://vuexamprep.com",
};

export async function renderEmailTemplate(
    template: string,
    data: Record<string, unknown> = {},
): Promise<string> {
    const fileName = template.endsWith(".ejs") ? template : `${template}.ejs`;
    const filePath = path.join(TEMPLATES_DIR, fileName);
    return ejs.renderFile(filePath, { ...BRAND, ...data });
}

// Render a template and send it in one step. `text` is the plain-text fallback.
export async function sendTemplatedEmail(
    to: string,
    subject: string,
    template: string,
    data: Record<string, unknown> = {},
    text = "",
): Promise<void> {
    const html = await renderEmailTemplate(template, data);
    await sendEmail(to, subject, text, html);
}

// Branded welcome email, sent right after a new account is created. Designed to
// be fire-and-forget by callers — a mail failure must never fail signup.
export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
    const firstName = (name || "").trim().split(/\s+/)[0] || "there";
    const appUrl = process.env.FRONTEND_URL || BRAND.appUrl;
    await sendTemplatedEmail(
        to,
        `Welcome to ${BRAND.brandName} 🎓`,
        "welcome",
        { firstName, appUrl },
        `Welcome to ${BRAND.brandName}, ${firstName}! Start preparing for your VU exams at ${appUrl}`,
    );
}
