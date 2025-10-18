var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  classifications: () => classifications,
  classificationsRelations: () => classificationsRelations,
  emails: () => emails,
  emailsRelations: () => emailsRelations,
  insertCategorySchema: () => insertCategorySchema,
  insertClassificationSchema: () => insertClassificationSchema,
  insertEmailSchema: () => insertEmailSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#3b82f6"),
  icon: text("icon").notNull().default("Folder"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gmailId: text("gmail_id").notNull().unique(),
  subject: text("subject").notNull().default("(No Subject)"),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  body: text("body"),
  snippet: text("snippet"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  embedding: text("embedding"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var classifications = pgTable("classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  confidence: real("confidence").notNull().default(0.5),
  isManual: boolean("is_manual").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var categoriesRelations = relations(categories, ({ many, one }) => ({
  classifications: many(classifications),
  user: one(users, {
    fields: [categories.userId],
    references: [users.id]
  })
}));
var emailsRelations = relations(emails, ({ many, one }) => ({
  classifications: many(classifications),
  user: one(users, {
    fields: [emails.userId],
    references: [users.id]
  })
}));
var classificationsRelations = relations(classifications, ({ one }) => ({
  email: one(emails, {
    fields: [classifications.emailId],
    references: [emails.id]
  }),
  category: one(categories, {
    fields: [classifications.categoryId],
    references: [categories.id]
  })
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
var insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true
});
var insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true
});
var insertClassificationSchema = createInsertSchema(classifications).omit({
  id: true,
  createdAt: true
});

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
if (!process.env.VITE_SUPABASE_URL) {
  throw new Error("VITE_SUPABASE_URL must be set");
}
var supabaseUrl = process.env.VITE_SUPABASE_URL;
var projectRef = supabaseUrl.replace("https://", "").split(".")[0];
var connectionString = `postgresql://postgres:postgres@db.${projectRef}.supabase.co:5432/postgres`;
var client = postgres(connectionString, {
  prepare: false
});
var db = drizzle(client, { schema: schema_exports });

// server/storage.ts
import { eq, sql as sql2, desc, and } from "drizzle-orm";
var DatabaseStorage = class {
  // Users
  async createUser(insertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async getUserById(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  // Categories
  async getCategories(userId) {
    return await db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.name);
  }
  async getCategoryById(id) {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || void 0;
  }
  async createCategory(insertCategory) {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }
  async updateCategory(id, insertCategory) {
    const [category] = await db.update(categories).set(insertCategory).where(eq(categories.id, id)).returning();
    return category || void 0;
  }
  async deleteCategory(id) {
    await db.delete(categories).where(eq(categories.id, id));
  }
  async getCategoriesWithStats(userId) {
    const totalEmailsResult = await db.select({ count: sql2`count(*)` }).from(emails).where(eq(emails.userId, userId));
    const totalEmails = Number(totalEmailsResult[0]?.count || 0);
    const categoriesData = await db.select({
      id: categories.id,
      userId: categories.userId,
      name: categories.name,
      description: categories.description,
      color: categories.color,
      icon: categories.icon,
      createdAt: categories.createdAt,
      emailCount: sql2`count(${classifications.id})`
    }).from(categories).leftJoin(classifications, eq(categories.id, classifications.categoryId)).where(eq(categories.userId, userId)).groupBy(categories.id).orderBy(categories.name);
    return categoriesData.map((cat) => ({
      ...cat,
      emailCount: Number(cat.emailCount),
      percentage: totalEmails > 0 ? Number(cat.emailCount) / totalEmails * 100 : 0
    }));
  }
  // Emails
  async getEmails(userId, filters) {
    let query = db.select({
      email: emails,
      classification: classifications,
      category: categories
    }).from(emails).leftJoin(classifications, eq(emails.id, classifications.emailId)).leftJoin(categories, eq(classifications.categoryId, categories.id)).where(eq(emails.userId, userId)).orderBy(desc(emails.receivedAt)).$dynamic();
    if (filters?.categoryId && filters.categoryId !== "all") {
      query = query.where(and(eq(emails.userId, userId), eq(classifications.categoryId, filters.categoryId)));
    }
    const results = await query;
    return results.map((row) => ({
      ...row.email,
      classification: row.classification && row.category ? {
        ...row.classification,
        category: row.category
      } : void 0
    }));
  }
  async getEmailById(id) {
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email || void 0;
  }
  async createEmail(insertEmail) {
    const [email] = await db.insert(emails).values(insertEmail).returning();
    return email;
  }
  async updateEmail(id, updateData) {
    const [email] = await db.update(emails).set(updateData).where(eq(emails.id, id)).returning();
    return email || void 0;
  }
  async getEmailByGmailId(gmailId) {
    const [email] = await db.select().from(emails).where(eq(emails.gmailId, gmailId));
    return email || void 0;
  }
  async getEmailsWithEmbeddings(userId) {
    return await db.select().from(emails).where(and(eq(emails.userId, userId), sql2`${emails.embedding} IS NOT NULL`));
  }
  // Classifications
  async createClassification(insertClassification) {
    const [classification] = await db.insert(classifications).values(insertClassification).returning();
    return classification;
  }
  async getClassificationByEmailId(emailId) {
    const [classification] = await db.select().from(classifications).where(eq(classifications.emailId, emailId));
    return classification || void 0;
  }
  async updateClassification(emailId, updateData) {
    await db.update(classifications).set(updateData).where(eq(classifications.emailId, emailId));
  }
  // Stats
  async getStats(userId) {
    const [emailCount] = await db.select({ count: sql2`count(*)` }).from(emails).where(eq(emails.userId, userId));
    const [categorizedCount] = await db.select({ count: sql2`count(distinct ${classifications.emailId})` }).from(classifications).innerJoin(emails, eq(emails.id, classifications.emailId)).where(eq(emails.userId, userId));
    const [categoryCount] = await db.select({ count: sql2`count(*)` }).from(categories).where(eq(categories.userId, userId));
    const [avgConfidence] = await db.select({ avg: sql2`avg(${classifications.confidence})` }).from(classifications).innerJoin(emails, eq(emails.id, classifications.emailId)).where(eq(emails.userId, userId));
    return {
      totalEmails: Number(emailCount?.count || 0),
      categorizedEmails: Number(categorizedCount?.count || 0),
      totalCategories: Number(categoryCount?.count || 0),
      averageConfidence: Number(avgConfidence?.avg || 0)
    };
  }
};
var storage = new DatabaseStorage();

// server/gmail.ts
import { google } from "googleapis";
var connectionSettings;
async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY ? "repl " + process.env.REPL_IDENTITY : process.env.WEB_REPL_RENEWAL ? "depl " + process.env.WEB_REPL_RENEWAL : null;
  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }
  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        "Accept": "application/json",
        "X_REPLIT_TOKEN": xReplitToken
      }
    }
  ).then((res) => res.json()).then((data) => data.items?.[0]);
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected");
  }
  return accessToken;
}
async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

// server/openai.ts
import OpenAI from "openai";
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}
var openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function generateEmbedding(text2) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text2
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dotProduct / (magnitudeA * magnitudeB);
}
function findBestCategory(emailEmbedding, categorizedEmails) {
  if (categorizedEmails.length === 0) {
    return null;
  }
  const similarities = categorizedEmails.map((email) => ({
    categoryId: email.categoryId,
    similarity: cosineSimilarity(emailEmbedding, email.embedding)
  }));
  const categoryScores = similarities.reduce((acc, { categoryId, similarity }) => {
    if (!acc[categoryId]) {
      acc[categoryId] = { total: 0, count: 0 };
    }
    acc[categoryId].total += similarity;
    acc[categoryId].count += 1;
    return acc;
  }, {});
  let bestCategory = null;
  for (const [categoryId, { total, count }] of Object.entries(categoryScores)) {
    const avgSimilarity = total / count;
    if (!bestCategory || avgSimilarity > bestCategory.confidence) {
      bestCategory = { categoryId, confidence: avgSimilarity };
    }
  }
  return bestCategory;
}

// server/routes.ts
import { z as z2 } from "zod";
import session from "express-session";
import crypto from "crypto";
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}
async function registerRoutes(app2) {
  app2.use(
    session({
      secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1e3
        // 24 hours
      }
    })
  );
  const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({ email, password: hashedPassword });
      req.session.userId = user.id;
      res.status(201).json({ user: { id: user.id, email: user.email } });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else if (error.message.includes("unique")) {
        res.status(400).json({ error: "Email already registered" });
      } else {
        console.error("Error registering user:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const hashedPassword = hashPassword(password);
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== hashedPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session.userId = user.id;
      res.json({ user: { id: user.id, email: user.email } });
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error logging in:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });
  app2.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    storage.getUserById(req.session.userId).then((user) => {
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      res.json({ user: { id: user.id, email: user.email } });
    }).catch((error) => {
      res.status(500).json({ error: error.message });
    });
  });
  app2.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStats(req.session.userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories2 = await storage.getCategories(req.session.userId);
      res.json(categories2);
    } catch (error) {
      console.error("Error getting categories:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/categories/stats", requireAuth, async (req, res) => {
    try {
      const categories2 = await storage.getCategoriesWithStats(req.session.userId);
      res.json(categories2);
    } catch (error) {
      console.error("Error getting categories with stats:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/categories", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse({ ...req.body, userId: req.session.userId });
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error creating category:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.patch("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse({ ...req.body, userId: req.session.userId });
      const category = await storage.updateCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z2.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error updating category:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });
  app2.delete("/api/categories/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/emails", requireAuth, async (req, res) => {
    try {
      const filters = {
        categoryId: req.query.category,
        search: req.query.search
      };
      const emails2 = await storage.getEmails(req.session.userId, filters);
      res.json(emails2);
    } catch (error) {
      console.error("Error getting emails:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/emails/sync", requireAuth, async (req, res) => {
    try {
      const gmail = await getUncachableGmailClient();
      const response = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10,
        q: "in:inbox"
      });
      const messages = response.data.messages || [];
      let syncedCount = 0;
      let newCount = 0;
      let errors = 0;
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (!message.id) continue;
        try {
          const existing = await storage.getEmailByGmailId(message.id);
          if (existing) {
            syncedCount++;
            continue;
          }
          if (i > 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const fullMessage = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full"
          });
          const headers = fullMessage.data.payload?.headers || [];
          const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "(No Subject)";
          const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown";
          const to = headers.find((h) => h.name?.toLowerCase() === "to")?.value || "Unknown";
          const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value;
          let body = fullMessage.data.snippet || "";
          if (fullMessage.data.payload?.body?.data) {
            body = Buffer.from(fullMessage.data.payload.body.data, "base64").toString("utf-8");
          } else if (fullMessage.data.payload?.parts) {
            const textPart = fullMessage.data.payload.parts.find((p) => p.mimeType === "text/plain");
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
            }
          }
          const textForEmbedding = `${subject}

${body}`.slice(0, 8e3);
          await new Promise((resolve) => setTimeout(resolve, 200));
          const embedding = await generateEmbedding(textForEmbedding);
          const email = await storage.createEmail({
            userId: req.session.userId,
            gmailId: message.id,
            subject,
            fromEmail: from,
            toEmail: to,
            body,
            snippet: fullMessage.data.snippet || "",
            receivedAt: dateHeader ? new Date(dateHeader) : /* @__PURE__ */ new Date(),
            embedding: JSON.stringify(embedding),
            isArchived: false
          });
          const categorizedEmails = await storage.getEmailsWithEmbeddings(req.session.userId);
          const emailsWithCategories = [];
          for (const catEmail of categorizedEmails) {
            const classification = await storage.getClassificationByEmailId(catEmail.id);
            if (classification && catEmail.embedding) {
              emailsWithCategories.push({
                embedding: JSON.parse(catEmail.embedding),
                categoryId: classification.categoryId
              });
            }
          }
          if (emailsWithCategories.length > 0) {
            const bestMatch = findBestCategory(embedding, emailsWithCategories);
            if (bestMatch && bestMatch.confidence > 0.5) {
              await storage.createClassification({
                emailId: email.id,
                categoryId: bestMatch.categoryId,
                confidence: bestMatch.confidence,
                isManual: false
              });
            }
          }
          newCount++;
          syncedCount++;
        } catch (emailError) {
          console.error(`Error processing email ${message.id}:`, emailError);
          errors++;
        }
      }
      res.json({
        success: true,
        synced: syncedCount,
        new: newCount,
        errors,
        total: messages.length
      });
    } catch (error) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/emails/:id/classify", requireAuth, async (req, res) => {
    try {
      const { categoryId, isManual } = req.body;
      if (!categoryId) {
        return res.status(400).json({ error: "categoryId is required" });
      }
      const email = await storage.getEmailById(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      const existingClassification = await storage.getClassificationByEmailId(email.id);
      if (existingClassification) {
        await storage.updateClassification(email.id, {
          categoryId,
          confidence: isManual ? 1 : existingClassification.confidence,
          isManual: isManual ? true : false
        });
      } else {
        await storage.createClassification({
          emailId: email.id,
          categoryId,
          confidence: isManual ? 1 : 0.5,
          isManual: isManual ? true : false
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error classifying email:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/emails/compute-embeddings", requireAuth, async (req, res) => {
    try {
      const emails2 = await storage.getEmails(req.session.userId);
      let processed = 0;
      for (const email of emails2) {
        if (!email.embedding || email.embedding.length === 0) {
          const textForEmbedding = `${email.subject}

${email.body || email.snippet}`.slice(0, 8e3);
          const embedding = await generateEmbedding(textForEmbedding);
          await storage.updateEmail(email.id, { embedding: JSON.stringify(embedding) });
          processed++;
        }
      }
      res.json({ success: true, processed });
    } catch (error) {
      console.error("Error computing embeddings:", error);
      res.status(500).json({ error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    strictPort: true,
    hmr: {
      clientPort: 443
    },
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
