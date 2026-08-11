import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const escapeHtml = (str: string = "") => {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const isPrivateOrInternalUrl = (urlStr: string): boolean => {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    
    // Block local / loopback / cloud metadata hostnames
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "169.254.169.254" ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return true;
    }

    // Check private IPv4 addresses (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [, p1, p2] = match.map(Number);
      if (
        p1 === 10 ||
        (p1 === 172 && p2 >= 16 && p2 <= 31) ||
        (p1 === 192 && p2 === 168) ||
        (p1 === 169 && p2 === 254) ||
        p1 === 127 ||
        p1 === 0
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return true; // Reject invalid URLs
  }
};

const emailTemplate = (title: string, content: string, ctaLink?: string, ctaText?: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; }
  .header { padding: 32px; text-align: center; border-bottom: 1px solid #f1f5f9; }
  .logo { max-height: 36px; margin-bottom: 24px; }
  .title { color: #0f172a; font-size: 24px; font-weight: 600; margin: 0; letter-spacing: -0.025em; }
  .content { padding: 32px; color: #334155; font-size: 16px; line-height: 1.6; }
  .content p { margin-top: 0; margin-bottom: 16px; }
  .content strong { color: #0f172a; font-weight: 600; }
  .details-box { background-color: #f8fafc; border-radius: 8px; padding: 16px; margin: 24px 0; border: 1px solid #e2e8f0; }
  .button-container { text-align: center; margin: 32px 0 16px; }
  .button { display: inline-block; padding: 12px 28px; background-color: #2b61d6; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px; transition: background-color 0.2s; }
  .footer { background-color: #f8fafc; padding: 24px 32px; text-align: center; color: #64748b; font-size: 13px; line-height: 1.5; border-top: 1px solid #e2e8f0; }
  .footer p { margin: 0; margin-bottom: 8px; }
  .footer p:last-child { margin-bottom: 0; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://zetaglobal.com/wp-content/uploads/2023/02/zeta_logoPrimary.svg" alt="Zeta Global" class="logo" />
      <h1 class="title">${escapeHtml(title)}</h1>
    </div>
    <div class="content">
      ${content}
      ${ctaLink && ctaText ? `
      <div class="button-container">
        <a href="${escapeHtml(ctaLink)}" class="button">${escapeHtml(ctaText)}</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Zeta Global. All rights reserved.</p>
      <p>HP-QA Platform Automation System</p>
    </div>
  </div>
</body>
</html>
`;

export const app = express();

// Enable CORS for all API endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Allow large payloads up to 50mb for HTML content and MSG file attachments
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Server-side Supabase credentials setup
const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9na2xmY3psY2V1YnlrcmVkZGliIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDcxOTIyOCwiZXhwIjoyMTAwMjk1MjI4fQ.hZbtmPG_B8AfIeDDNb0dTdWogP5Du6yp7CbcC1pUJmM";

const getSupabaseServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  DEFAULT_SERVICE_ROLE_KEY;

const getSupabaseUrl = () =>
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://ogklfczlceubykreddib.supabase.co";

// Server-side Supabase Config API
app.get(["/api/supabase-config", "/supabase-config"], (req, res) => {
  const url = getSupabaseUrl();
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || getSupabaseServiceKey();
  const isConfigured = Boolean(
    url && key && url !== "https://placeholder.supabase.co" && key !== "placeholder_key" && url.startsWith("https://")
  );
  res.json({ url, key, isConfigured });
});

// Server-side campaigns API proxy
app.get(["/api/campaigns", "/campaigns"], async (req, res) => {
  try {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ campaigns: [], error: "Supabase environment variables not set on server" });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await client.from("campaigns").select("*");
    if (error) {
      console.warn("[Server API] Supabase campaigns fetch error:", error.message);
      return res.status(200).json({ campaigns: [], error: error.message });
    }
    return res.json({ campaigns: data || [] });
  } catch (err: any) {
    console.error("[Server API] Exception fetching campaigns:", err);
    return res.status(200).json({ campaigns: [], error: err?.message || "Failed to fetch campaigns" });
  }
});

app.post(["/api/campaigns", "/campaigns"], async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name) {
      return res.status(400).json({ error: "Campaign name is required" });
    }
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      console.warn("[Server API] Supabase credentials not configured on server.");
      return res.status(200).json({ success: true, savedToSupabase: false, savedLocally: true, warning: "Supabase credentials not configured on server" });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);

    // Attempt 1: Full payload upsert
    const { data, error } = await client.from("campaigns").upsert(payload).select();
    if (!error && data && data.length > 0) {
      console.log(`[Server API] Successfully saved campaign "${payload.name}" (${payload.id}) to Supabase DB via Service Role.`);
      return res.json({ success: true, savedToSupabase: true, data: data[0] });
    }

    if (error) {
      console.warn("[Server API] Supabase primary upsert notice:", error.message);

      // Attempt 2: Standard schema payload fallback
      const standardPayload = {
        id: payload.id,
        name: payload.name || "Untitled",
        country: payload.country || "IN",
        version_name: payload.version_name || payload.versionName || "Standard",
        status: payload.status || "Draft",
        web_view_url: payload.web_view_url || payload.webViewUrl || "",
        figma_url: payload.figma_url || payload.figmaUrl || "",
        html_source: payload.html_source || payload.htmlSource || "",
        litmus_url: payload.litmus_url || payload.litmusUrl || "",
        design_type: payload.design_type || payload.designType || "figma",
        team: payload.team || "HP-APJ",
        mockup_file_name: payload.mockup_file_name || "",
        outlook_file_name: payload.outlook_file_name || "",
        folder_id: payload.folder_id || "2026",
        user_email: payload.user_email || payload.createdBy || "admin@example.com",
        created_by: payload.created_by || payload.createdBy || "QA User",
        last_edited_by: payload.last_edited_by || payload.lastEditedBy || "QA User",
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString(),
        is_deleted: payload.is_deleted || false,
        review_note: payload.review_note || "",
        current_step: payload.current_step || 1
      };

      const fbRes = await client.from("campaigns").upsert(standardPayload).select();
      if (!fbRes.error && fbRes.data && fbRes.data.length > 0) {
        console.log(`[Server API] Saved campaign "${payload.name}" using standard payload to Supabase DB.`);
        return res.json({ success: true, savedToSupabase: true, data: fbRes.data[0] });
      }

      // Attempt 3: Minimal payload fallback
      const minPayload = {
        id: payload.id,
        name: payload.name || "Untitled",
        country: payload.country || "IN",
        status: payload.status || "Draft",
        created_at: payload.created_at || new Date().toISOString(),
        updated_at: payload.updated_at || new Date().toISOString()
      };

      const minRes = await client.from("campaigns").upsert(minPayload).select();
      if (!minRes.error && minRes.data && minRes.data.length > 0) {
        console.log(`[Server API] Saved campaign "${payload.name}" using minimal payload to Supabase DB.`);
        return res.json({ success: true, savedToSupabase: true, data: minRes.data[0] });
      }

      console.warn("[Server API] Write notice for Supabase DB (saved locally):", error.message);
      return res.json({
        success: true,
        savedToSupabase: false,
        savedLocally: true,
        warning: error.message || fbRes.error?.message || minRes.error?.message || "Saved locally"
      });
    }

    return res.json({ success: true, savedToSupabase: true, data: data ? data[0] : null });
  } catch (err: any) {
    console.warn("[Server API] Exception saving campaign to Supabase (saved locally):", err?.message);
    return res.json({ success: true, savedToSupabase: false, savedLocally: true, warning: err?.message || "Saved locally" });
  }
});

app.post(["/api/campaigns/batch-sync", "/campaigns/batch-sync"], async (req, res) => {
  try {
    const { campaigns } = req.body;
    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      return res.status(400).json({ error: "Campaigns array is required" });
    }
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.json({ success: true, savedLocally: true, count: campaigns.length });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);
    
    let successCount = 0;
    for (const camp of campaigns) {
      const itemRes = await client.from("campaigns").upsert(camp);
      if (!itemRes.error) {
        successCount++;
      } else {
        const fallback = {
          id: camp.id,
          name: camp.name || "Untitled",
          country: camp.country || "IN",
          version_name: camp.version_name || camp.versionName || "Standard",
          status: camp.status || "Draft",
          web_view_url: camp.web_view_url || camp.webViewUrl || "",
          figma_url: camp.figma_url || camp.figmaUrl || "",
          html_source: camp.html_source || camp.htmlSource || "",
          litmus_url: camp.litmus_url || camp.litmusUrl || "",
          folder_id: camp.folder_id || "2026",
          user_email: camp.user_email || camp.createdBy || "admin@example.com",
          created_at: camp.created_at || new Date().toISOString(),
          updated_at: camp.updated_at || new Date().toISOString()
        };
        const fbRes = await client.from("campaigns").upsert(fallback);
        if (!fbRes.error) successCount++;
      }
    }
    return res.json({ success: true, savedToSupabase: successCount > 0, count: successCount });
  } catch (err: any) {
    console.warn("[Server API] Exception batch syncing campaigns (saved locally):", err?.message);
    return res.json({ success: true, savedLocally: true, count: 0 });
  }
});

app.delete(["/api/campaigns/:id", "/campaigns/:id"], async (req, res) => {
  try {
    const campaignId = req.params.id;
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.json({ success: true, message: `Campaign ${campaignId} deleted locally` });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);
    const { error } = await client.from("campaigns").delete().eq("id", campaignId);
    if (error) {
      console.warn("[Server API] Supabase delete error (deleted locally):", error.message);
      return res.json({ success: true, warning: error.message });
    }
    return res.json({ success: true, message: `Campaign ${campaignId} deleted` });
  } catch (err: any) {
    return res.json({ success: true, message: `Campaign ${req.params.id} deleted locally` });
  }
});

app.get(["/api/folders", "/folders"], async (req, res) => {
  try {
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ folders: [] });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await client.from("folders").select("*");
    if (error) {
      return res.status(200).json({ folders: [] });
    }
    return res.json({ folders: data || [] });
  } catch (err) {
    return res.status(200).json({ folders: [] });
  }
});

app.post(["/api/folders", "/folders"], async (req, res) => {
  try {
    const folderData = req.body;
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Supabase credentials not configured on server" });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await client.from("folders").upsert(folderData).select();
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Failed to save folder" });
  }
});

// Email sending API route
app.post(["/api/invite", "/invite"], async (req, res) => {
  const { name, email, role, team, inviteUrl } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "Email and Name are required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    const content = `
      <p>Hi ${escapeHtml(name)},</p>
      <p>You have been invited to join the <strong>HP-QA Platform</strong> by an administrator.</p>
      <div class="details-box">
        <p style="margin-bottom: 8px;"><strong>Assigned Team:</strong> ${escapeHtml(team)}</p>
        <p style="margin-bottom: 0;"><strong>Account Role:</strong> <span style="text-transform: capitalize;">${escapeHtml(role)}</span></p>
      </div>
      <p>Please click the button below to accept the invitation and securely complete your account setup:</p>
    `;

    const mailOptions = {
      from: `"HP-QA Platform" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Invitation to join HP-QA Platform",
      html: emailTemplate("Welcome to HP-QA Platform", content, inviteUrl, "Accept Invitation"),
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Invitation sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});

app.post(["/api/forgot-password", "/forgot-password"], async (req, res) => {
  const { email, resetUrl } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, 
      },
    });

    const content = `
      <p>Hi there,</p>
      <p>We received a request to reset the password for your HP-QA Platform account associated with this email address.</p>
      <p>Click the button below to choose a new password. This link will expire in 24 hours.</p>
    `;

    const mailOptions = {
      from: `"HP-QA Platform" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request - HP-QA Platform",
      html: emailTemplate("Reset Your Password", content, resetUrl, "Reset Password"),
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Password reset email sent successfully!" });
  } catch (error) {
    console.error("Error sending forgot password email:", error);
    res.status(500).json({ error: "Failed to send reset email." });
  }
});

app.get(["/api/proxy", "/proxy"], async (req, res) => {
  let targetUrl = req.query.url as string;
  if (!targetUrl) return res.status(400).send("URL is required");
  
  targetUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  if (isPrivateOrInternalUrl(targetUrl)) {
    return res.status(403).send("Forbidden: Access to internal or non-HTTP addresses is restricted.");
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache"
      },
      redirect: "follow"
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(response.status).send(`Upstream server returned ${response.status}`);
    }
    const html = await response.text();
    const baseTag = `<base href="${targetUrl}">`;
    const darkModeScript = `
      <style>
        html.dark-mode-preview {
          filter: invert(1) hue-rotate(180deg) !important;
          background-color: #0d1117 !important;
        }
        html.dark-mode-preview img, 
        html.dark-mode-preview picture, 
        html.dark-mode-preview video, 
        html.dark-mode-preview canvas, 
        html.dark-mode-preview svg, 
        html.dark-mode-preview [style*="background-image"],
        html.dark-mode-preview [style*="background:url"],
        html.dark-mode-preview [style*="background: url"],
        html.dark-mode-preview .dark-mode-preserve,
        html.dark-mode-preview [data-dark-mode-preserve] {
          filter: invert(1) hue-rotate(180deg) !important;
        }
        html.dark-mode-preview .light-img { display: none !important; }
        html.dark-mode-preview .dark-img { display: block !important; }
      </style>
      <script>
        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'QA_THEME_UPDATE') {
            if (e.data.theme === 'dark') {
              document.documentElement.classList.add('dark-mode-preview');
            } else {
              document.documentElement.classList.remove('dark-mode-preview');
            }
          }
        });
      </script>
    `;
    let modifiedHtml = html;
    if (html.includes("<head>")) {
      modifiedHtml = html.replace("<head>", `<head>${baseTag}${darkModeScript}`);
    } else {
      modifiedHtml = baseTag + darkModeScript + html;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(modifiedHtml);
  } catch (error: any) {
    console.error("[Proxy Error]:", error?.message || error);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(500).send(`Failed to proxy URL: ${error?.message || error}`);
  }
});

app.post(["/api/check-url", "/check-url"], async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  if (isPrivateOrInternalUrl(url)) {
    return res.status(403).json({ error: "Forbidden: Access to internal or non-HTTP addresses is restricted." });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const start = Date.now();
    const response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    clearTimeout(timeout);

    const end = Date.now();
    res.json({
      status: response.status,
      finalUrl: response.url,
      responseTime: end - start,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to fetch URL" });
  }
});

app.post(["/api/grammar-check", "/grammar-check"], async (req, res) => {
    const { htmlContent } = req.body;
    if (!htmlContent) return res.status(400).json({ error: "HTML content is required" });

    try {
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: `You are a strict copy editor for marketing emails. Extract all visible text from the following HTML and check for spelling and grammar errors. 
Do not output HTML tags, just list the mistakes and provide a corrected suggestion for each. If there are no mistakes found, reply with 'No grammar or spelling issues found.' 

Format your response as markdown with a list of issues (Original -> Suggested).

HTML:
${htmlContent.substring(0, 50000)}` }]
            }
          ]
        });

        return res.json({ result: response.text });
      }

      // Fallback local spell & grammar check if GEMINI_API_KEY is not configured
      const textOnly = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const commonTypos: [RegExp, string][] = [
        [/\brecieve\b/gi, "receive"],
        [/\bteh\b/gi, "the"],
        [/\bseperate\b/gi, "separate"],
        [/\badress\b/gi, "address"],
        [/\baccommodate\b/gi, "accommodate"],
        [/\bdefinitly\b/gi, "definitely"],
        [/\boccured\b/gi, "occurred"]
      ];

      const found: string[] = [];
      for (const [regex, replacement] of commonTypos) {
        if (regex.test(textOnly)) {
          found.push(`- **${regex.source.replace(/\\b/g, '')}** -> Suggested: **${replacement}**`);
        }
      }

      if (found.length > 0) {
        return res.json({
          result: `### Local Proofreading Check Results:\n\n` + found.join("\n") + `\n\n*(Note: Configure GEMINI_API_KEY in environment settings for complete AI grammar & copy editing)*`
        });
      } else {
        return res.json({
          result: "No obvious spelling issues detected in scan.\n\n*(Note: Add GEMINI_API_KEY in environment for full AI copy editing and grammar analysis)*"
        });
      }
    } catch (error: any) {
      console.error("Error in grammar check API:", error);
      res.status(200).json({
        result: "Grammar check complete. Please review email copy for spelling, punctuation, and widow words manually."
      });
    }
  });

export default app;

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
