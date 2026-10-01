import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import nodemailer from "nodemailer";

export const prerender = false;

// Studio Email
const RECIPIENT_EMAIL = "kldesignstudio.arch@gmail.com";

const REQUIRED_FIELDS = [
  "fullName",
  "email",
  "phone",
  "gender",
  "civilStatus",
  "age",
  "location",
  "size",
  "land",
  "typeOfProject",
  "budget",
  "investmentLevel",
  "vision",
  "referral",
  "timeline",
] as const;

type ContactField = (typeof REQUIRED_FIELDS)[number];

type ContactSubmission = Record<ContactField, string> & {
  website?: string;
};

const MAX_BODY_SIZE = 20_000;

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function jsonResponse(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function cleanValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
      "",
    )
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTransporter() {
  const user = getSecret("SMTP_USER");
  const pass = getSecret("SMTP_PASS");

  if (!user || !pass) {
    throw new Error("SMTP configuration is incomplete.");
  }

  return {
    transporter: nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    }),
    user,
  };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // --------------------------------------------------------------
    // Request validation
    // --------------------------------------------------------------

    const contentLength = Number(request.headers.get("content-length") ?? "0");

    if (contentLength > MAX_BODY_SIZE) {
      return jsonResponse(
        {
          message: "Request is too large.",
        },
        413,
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return jsonResponse(
        {
          message: "Unsupported content type.",
        },
        415,
      );
    }

    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return jsonResponse(
        {
          message: "Invalid request body.",
        },
        400,
      );
    }

    const raw = body as Record<string, unknown>;

    // --------------------------------------------------------------
    // Honeypot
    // --------------------------------------------------------------

    if (typeof raw.website === "string" && raw.website.trim() !== "") {
      // Silently accept automated submissions.
      return jsonResponse(
        {
          message: "Submission received.",
        },
        200,
      );
    }

    // --------------------------------------------------------------
    // Normalize submission
    // --------------------------------------------------------------

    const submission = {} as ContactSubmission;

    for (const field of REQUIRED_FIELDS) {
      submission[field] = cleanValue(raw[field]);
    }

    // --------------------------------------------------------------
    // Required-field validation
    // --------------------------------------------------------------

    for (const field of REQUIRED_FIELDS) {
      if (!submission[field]) {
        return jsonResponse(
          {
            message: `Missing required field: ${field}.`,
          },
          400,
        );
      }
    }

    // --------------------------------------------------------------
    // Email validation
    // --------------------------------------------------------------

    if (!EMAIL_PATTERN.test(submission.email)) {
      return jsonResponse(
        {
          message: "Invalid email address.",
        },
        400,
      );
    }

    // --------------------------------------------------------------
    // Length validation
    // --------------------------------------------------------------

    const lengthLimits: Partial<Record<ContactField, number>> = {
      fullName: 80,
      email: 254,
      phone: 20,
      location: 120,
      vision: 200,
    };

    for (const [field, maxLength] of Object.entries(lengthLimits)) {
      const contactField = field as ContactField;
      const value = submission[contactField];

      if (value.length > maxLength) {
        return jsonResponse(
          {
            message: `${field} is too long.`,
          },
          400,
        );
      }
    }

    // --------------------------------------------------------------
    // SMTP
    // --------------------------------------------------------------

    const { transporter, user } = getTransporter();

    // --------------------------------------------------------------
    // Escape values used in HTML email
    // --------------------------------------------------------------

    const escaped = {
      fullName: escapeHtml(submission.fullName),
      email: escapeHtml(submission.email),
      phone: escapeHtml(submission.phone),
      gender: escapeHtml(submission.gender),
      civilStatus: escapeHtml(submission.civilStatus),
      age: escapeHtml(submission.age),
      location: escapeHtml(submission.location),
      size: escapeHtml(submission.size),
      land: escapeHtml(submission.land),
      typeOfProject: escapeHtml(submission.typeOfProject),
      budget: escapeHtml(submission.budget),
      investmentLevel: escapeHtml(submission.investmentLevel),
      vision: escapeHtml(submission.vision),
      referral: escapeHtml(submission.referral),
      timeline: escapeHtml(submission.timeline),
    };

    // ==============================================================
    // 1. SEND COMPLETE ENQUIRY TO THE STUDIO
    // ==============================================================

    await transporter.sendMail({
      from: `"Website Contact Form" <${user}>`,
      to: RECIPIENT_EMAIL,

      // Clicking Reply from the studio inbox replies directly to
      // the person who submitted the form.
      replyTo: submission.email,

      subject: `New Project Enquiry — ${submission.fullName}`,

      text: `
New Project Enquiry

PERSONAL DETAILS
----------------
Full Name: ${submission.fullName}
Email: ${submission.email}
Phone: ${submission.phone}
Gender: ${submission.gender}
Civil Status: ${submission.civilStatus}
Age: ${submission.age}

PROJECT DETAILS
---------------
Location: ${submission.location}
Lot / Floor Area: ${submission.size} sqm
Land / Property: ${submission.land}
Project Type: ${submission.typeOfProject}
Construction Budget: ${submission.budget}
A&E Investment Level: ${submission.investmentLevel}

VISION & ALIGNMENT
-----------------
Goals: ${submission.vision}
Reason for Choosing Firm: ${submission.referral}
Construction Timeline: ${submission.timeline}
      `.trim(),

      html: `
        <h2>New Project Enquiry</h2>

        <h3>Personal Details</h3>

        <table cellpadding="6" cellspacing="0" border="0">
          <tr>
            <td><strong>Full Name</strong></td>
            <td>${escaped.fullName}</td>
          </tr>

          <tr>
            <td><strong>Email</strong></td>
            <td>${escaped.email}</td>
          </tr>

          <tr>
            <td><strong>Phone</strong></td>
            <td>${escaped.phone}</td>
          </tr>

          <tr>
            <td><strong>Gender</strong></td>
            <td>${escaped.gender}</td>
          </tr>

          <tr>
            <td><strong>Civil Status</strong></td>
            <td>${escaped.civilStatus}</td>
          </tr>

          <tr>
            <td><strong>Age</strong></td>
            <td>${escaped.age}</td>
          </tr>
        </table>

        <h3>Project Details</h3>

        <table cellpadding="6" cellspacing="0" border="0">
          <tr>
            <td><strong>Location</strong></td>
            <td>${escaped.location}</td>
          </tr>

          <tr>
            <td><strong>Lot / Floor Area</strong></td>
            <td>${escaped.size} sqm</td>
          </tr>

          <tr>
            <td><strong>Land / Property</strong></td>
            <td>${escaped.land}</td>
          </tr>

          <tr>
            <td><strong>Project Type</strong></td>
            <td>${escaped.typeOfProject}</td>
          </tr>

          <tr>
            <td><strong>Construction Budget</strong></td>
            <td>${escaped.budget}</td>
          </tr>

          <tr>
            <td><strong>A&E Investment Level</strong></td>
            <td>${escaped.investmentLevel}</td>
          </tr>
        </table>

        <h3>Vision & Alignment</h3>

        <table cellpadding="6" cellspacing="0" border="0">
          <tr>
            <td><strong>Goals</strong></td>
            <td>${escaped.vision}</td>
          </tr>

          <tr>
            <td><strong>Why This Firm</strong></td>
            <td>${escaped.referral}</td>
          </tr>

          <tr>
            <td><strong>Timeline</strong></td>
            <td>${escaped.timeline}</td>
          </tr>
        </table>
      `.trim(),
    });

    // ==============================================================
    // 2. SEND CONFIRMATION TO THE PERSON WHO SUBMITTED THE FORM
    // ==============================================================

    await transporter.sendMail({
      from: `"Khu + Lugtu Design Studio" <${user}>`,

      // IMPORTANT:
      // This is the email address entered by the user.
      to: submission.email,

      // If the user replies to the confirmation email,
      // the reply goes back to the studio.
      replyTo: RECIPIENT_EMAIL,

      subject: "We received your project enquiry",

      text: `
Hi ${submission.fullName},

Thank you for contacting Khu + Lugtu Design Studio.

We have received your project enquiry and will review the information you provided.

Our team will be in touch to discuss the next steps within 5 business days.

PROJECT DETAILS
---------------
Location: ${submission.location}
Project Type: ${submission.typeOfProject}
Construction Budget: ${submission.budget}
Target Construction Timeline: ${submission.timeline}

If you need to provide additional information, you can simply reply to this email.

Khu + Lugtu Design Studio
      `.trim(),

      html: `
        <div>
          <h2>We received your project enquiry</h2>

          <p>
            Hi ${escaped.fullName},
          </p>

          <p>
            Thank you for contacting Khu + Lugtu Design Studio.
          </p>

          <p>
            We have received your project enquiry and will review the
            information you provided.
          </p>

          <p>
            Our team will be in touch to discuss the next steps within
            <strong>5 business days</strong>.
          </p>

          <h3>Project Details</h3>

          <table cellpadding="6" cellspacing="0" border="0">
            <tr>
              <td><strong>Location</strong></td>
              <td>${escaped.location}</td>
            </tr>

            <tr>
              <td><strong>Project Type</strong></td>
              <td>${escaped.typeOfProject}</td>
            </tr>

            <tr>
              <td><strong>Construction Budget</strong></td>
              <td>${escaped.budget}</td>
            </tr>

            <tr>
              <td><strong>Target Construction Timeline</strong></td>
              <td>${escaped.timeline}</td>
            </tr>
          </table>

          <p>
            If you need to provide additional information, you can simply
            reply to this email.
          </p>

          <p>
            Khu + Lugtu Design Studio
          </p>
        </div>
      `.trim(),
    });

    // --------------------------------------------------------------
    // Success
    // --------------------------------------------------------------

    return jsonResponse(
      {
        message: "Your enquiry has been sent successfully.",
      },
      200,
    );
  } catch (error) {
    console.error("Contact form submission failed:", error);

    return jsonResponse(
      {
        message: "Unable to send your enquiry right now.",
      },
      500,
    );
  }
};
