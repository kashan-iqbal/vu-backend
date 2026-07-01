import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import ejs from "ejs";
import path from "path";
import fs from "fs";

export async function sendEmail(
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
        from: `"ExamPrep AI" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
        attachments,
    });
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
    supportEmail: process.env.SMTP_USER || "support@examprep.ai",
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
