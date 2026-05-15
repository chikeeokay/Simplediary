import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import { google } from "googleapis";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Need to be careful because APP_URL might change or be different for shared vs dev.
  // Better to use dynamic determination from the request for the callback.
  const getRedirectUri = (req: express.Request) => {
    // In dev: req.protocol + "://" + req.get('host') + "/auth/callback" doesn't always work reliably due to proxy.
    // Instead use the environment variable if available, fallback to req based host.
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.headers.host}`;
    return `${baseUrl}/auth/callback`;
  };

  const getAuthClient = (req: express.Request) => {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
  };

  // API constraints check
  app.get("/api/auth/url", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: "OAuth environment variables missing. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    }

    const client = getAuthClient(req);
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email"
      ],
      prompt: "consent",
    });

    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("No code provided.");
    }

    try {
      const client = getAuthClient(req);
      const { tokens } = await client.getToken(code as string);
      
      // We set tokens in httpOnly cookies
      res.cookie("calendar_auth", JSON.stringify(tokens), {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      });

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error exchanging token:", error);
      res.status(500).send("Authentication failed. Please check your credentials.");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("calendar_auth", {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    });
    res.json({ success: true });
  });

  app.get("/api/auth/status", (req, res) => {
    const tokensStr = req.cookies.calendar_auth;
    if (tokensStr) {
      return res.json({ isAuthenticated: true });
    }
    res.json({ isAuthenticated: false });
  });

  // Proxy API for Calendar to avoid exposing tokens
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const tokensStr = req.cookies.calendar_auth;
      if (!tokensStr) return res.status(401).json({ error: "Unauthorized" });

      const tokens = JSON.parse(tokensStr);
      const client = getAuthClient(req);
      client.setCredentials(tokens);

      const calendar = google.calendar({ version: "v3", auth: client });
      
      // Fetch events from the last 1 year and the next 2 years
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 1);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 2);

      const primaryResponse = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const holidayTranslations: Record<string, string> = {
        "new year's day": "一月一日",
        "first day of january": "一月一日",
        "lunar new year's day": "農曆新年假期",
        "second day of lunar new year": "農曆新年假期",
        "third day of lunar new year": "農曆新年假期",
        "fourth day of lunar new year": "農曆新年假期",
        "ching ming festival": "清明節",
        "good friday": "耶穌受難節",
        "day following good friday": "耶穌受難節翌日",
        "easter monday": "復活節星期一",
        "labour day": "勞動節",
        "birthday of the buddha": "佛誕",
        "buddha's birthday": "佛誕",
        "tuen ng festival": "端午節",
        "hong kong special administrative region establishment day": "特區成立紀念日",
        "establishment day": "特區成立紀念日",
        "day following the chinese mid-autumn festival": "中秋節翌日",
        "chinese mid-autumn festival": "中秋節",
        "national day": "國慶日",
        "chung yeung festival": "重陽節",
        "christmas day": "聖誕節",
        "first weekday after christmas day": "聖誕節翌日",
        "boxing day": "聖誕節翌日"
      };

      let hkHolidays: any[] = [];
      try {
        const hkResponse = await calendar.events.list({
          calendarId: "zh-tw.hong_kong#holiday@group.v.calendar.google.com",
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });
        
        hkHolidays = (hkResponse.data.items || [])
          .filter(item => {
            const desc = item.description || "";
            const summary = (item.summary || "").toLowerCase();
            const lowerDesc = desc.toLowerCase();
            // Strictly only keep the holiday if it's explicitly marked as a public holiday in the description
            return lowerDesc.includes("public holiday") || lowerDesc.includes("公眾假期") || lowerDesc.includes("national holiday") || lowerDesc.includes("bank holiday");
          })
          .map(item => {
            let summary = item.summary || "";
            const lowerSummary = summary.toLowerCase();
            const sortedTranslations = Object.entries(holidayTranslations).sort((a, b) => b[0].length - a[0].length);
            for (const [key, value] of sortedTranslations) {
              if (lowerSummary.includes(key.toLowerCase())) {
                summary = value;
                break;
              }
            }
            return {
              ...item,
              summary,
              description: undefined, // Hide the boilerplate text
              isHoliday: true, // A flag so client can style it differently if needed, or know it can't be deleted
            };
          })
          .filter(item => !/[a-zA-Z]/.test(item.summary)); // Remove any untranslated English holidays
      } catch (err) {
        console.error("Could not fetch Google HK holidays:", err);
      }
      
      // Also fetch from 1823.gov.hk to ensure Traditional Chinese
      try {
        const icalModule = await import('node-ical');
        const ical = icalModule.default || icalModule;
        const data = await ical.async.fromURL('https://www.1823.gov.hk/common/ical/tc.ics');
        const govHolidays = Object.values(data)
          .filter(ev => ev.type === 'VEVENT')
          .map((ev: any) => ({
            id: ev.uid,
            summary: ev.summary,
            start: ev.start?.dateOnly ? { date: ev.start.toISOString().split('T')[0] } : { dateTime: ev.start?.toISOString() },
            end: ev.end?.dateOnly ? { date: ev.end.toISOString().split('T')[0] } : { dateTime: ev.end?.toISOString() },
            isHoliday: true,
          }))
          // Only include holidays in the queried time range
          .filter(ev => {
            const dateStr = ev.start.date || ev.start.dateTime;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            return d >= timeMin && d <= timeMax;
          });
          
        for (const ev of govHolidays) {
          const dateStr = ev.start.date || ev.start.dateTime?.split('T')[0];
          // Remove any Google holiday on the same date
          hkHolidays = hkHolidays.filter(h => {
             const hDateStr = h.start.date || h.start.dateTime?.split('T')[0];
             return hDateStr !== dateStr;
          });
          hkHolidays.push(ev);
        }
      } catch (err) {
        console.error("Could not fetch 1823 HK holidays:", err);
      }

      res.json([...(primaryResponse.data.items || []), ...hkHolidays]);
    } catch (error: any) {
      console.error("Failed to fetch events:", error?.message || error);
      if (error?.message?.includes("insufficient") || error?.message?.includes("scopes")) {
        res.clearCookie("calendar_auth");
        return res.status(403).json({ error: "授權不足，請重新登入並勾選日曆權限！" });
      }
      res.status(500).json({ error: error?.message || "Failed to fetch events" });
    }
  });

  app.post("/api/calendar/events", async (req, res) => {
    try {
      const tokensStr = req.cookies.calendar_auth;
      if (!tokensStr) return res.status(401).json({ error: "Unauthorized" });

      const tokens = JSON.parse(tokensStr);
      const client = getAuthClient(req);
      client.setCredentials(tokens);

      const calendar = google.calendar({ version: "v3", auth: client });
      
      const eventData = req.body;
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventData,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Failed to insert event:", error?.message || error);
      if (error?.message?.includes("insufficient") || error?.message?.includes("scopes")) {
        res.clearCookie("calendar_auth");
        return res.status(403).json({ error: "授權不足，請重新登入並勾選日曆權限！" });
      }
      res.status(500).json({ error: error?.message || "Failed to insert event" });
    }
  });

  app.put("/api/calendar/events/:eventId", async (req, res) => {
    try {
      const tokensStr = req.cookies.calendar_auth;
      if (!tokensStr) return res.status(401).json({ error: "Unauthorized" });

      const tokens = JSON.parse(tokensStr);
      const client = getAuthClient(req);
      client.setCredentials(tokens);

      const calendar = google.calendar({ version: "v3", auth: client });
      
      const eventData = req.body;
      const response = await calendar.events.update({
        calendarId: "primary",
        eventId: req.params.eventId,
        requestBody: eventData,
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("Failed to update event:", error?.message || error);
      if (error?.message?.includes("insufficient") || error?.message?.includes("scopes")) {
        res.clearCookie("calendar_auth");
        return res.status(403).json({ error: "授權不足，請重新登入並勾選日曆權限！" });
      }
      res.status(500).json({ error: error?.message || "Failed to update event" });
    }
  });

  app.delete("/api/calendar/events/:eventId", async (req, res) => {
    try {
      const tokensStr = req.cookies.calendar_auth;
      if (!tokensStr) return res.status(401).json({ error: "Unauthorized" });

      const tokens = JSON.parse(tokensStr);
      const client = getAuthClient(req);
      client.setCredentials(tokens);

      const calendar = google.calendar({ version: "v3", auth: client });
      
      await calendar.events.delete({
        calendarId: "primary",
        eventId: req.params.eventId,
      });

      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("Resource has been deleted") || error?.status === 404 || error?.status === 410) {
        return res.json({ success: true });
      }
      console.error("Failed to delete event:", error?.message || error);
      if (error?.message?.includes("insufficient") || error?.message?.includes("scopes")) {
        res.clearCookie("calendar_auth");
        return res.status(403).json({ error: "授權不足，請重新登入並勾選日曆權限！" });
      }
      res.status(500).json({ error: error?.message || "Failed to delete event" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
    console.log("Server running on http://localhost:" + PORT);
  });
}

startServer();
