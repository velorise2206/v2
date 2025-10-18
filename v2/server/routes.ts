import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getUncachableGmailClient } from "./gmail";
import { generateEmbedding, findBestCategory } from "./openai";
import { insertCategorySchema, insertEmailSchema, insertClassificationSchema, insertUserSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import session from "express-session";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    })
  );

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Auth endpoints
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const hashedPassword = hashPassword(password);
      
      const user = await storage.createUser({ email, password: hashedPassword });
      req.session.userId = user.id;
      
      res.status(201).json({ user: { id: user.id, email: user.email } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else if (error.message.includes("unique")) {
        res.status(400).json({ error: "Email already registered" });
      } else {
        console.error("Error registering user:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const hashedPassword = hashPassword(password);
      
      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== hashedPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      req.session.userId = user.id;
      res.json({ user: { id: user.id, email: user.email } });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error logging in:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    storage.getUserById(req.session.userId).then(user => {
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      res.json({ user: { id: user.id, email: user.email } });
    }).catch((error) => {
      res.status(500).json({ error: error.message });
    });
  });

  // Stats endpoint
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error getting stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Categories endpoints
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      console.error("Error getting categories:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/categories/stats", async (req, res) => {
    try {
      const categories = await storage.getCategoriesWithStats();
      res.json(categories);
    } catch (error: any) {
      console.error("Error getting categories with stats:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error creating category:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.updateCategory(req.params.id, validatedData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        console.error("Error updating category:", error);
        res.status(500).json({ error: error.message });
      }
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Emails endpoints
  app.get("/api/emails", async (req, res) => {
    try {
      const filters = {
        categoryId: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
      };
      const emails = await storage.getEmails(filters);
      res.json(emails);
    } catch (error: any) {
      console.error("Error getting emails:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync emails from Gmail (with rate limiting)
  app.post("/api/emails/sync", async (req, res) => {
    try {
      const gmail = await getUncachableGmailClient();
      
      // Fetch messages from Gmail (last 10 for demo to avoid rate limits)
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        q: 'in:inbox',
      });

      const messages = response.data.messages || [];
      let syncedCount = 0;
      let newCount = 0;
      let errors = 0;

      // Process emails with delay to avoid rate limits
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        if (!message.id) continue;

        try {
          // Check if email already exists
          const existing = await storage.getEmailByGmailId(message.id);
          if (existing) {
            syncedCount++;
            continue;
          }

          // Add delay between API calls (100ms)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Fetch full message details
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const headers = fullMessage.data.payload?.headers || [];
          const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
          const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || 'Unknown';
          const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date')?.value;
          
          // Extract body
          let body = fullMessage.data.snippet || '';
          if (fullMessage.data.payload?.body?.data) {
            body = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString('utf-8');
          } else if (fullMessage.data.payload?.parts) {
            const textPart = fullMessage.data.payload.parts.find(p => p.mimeType === 'text/plain');
            if (textPart?.body?.data) {
              body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
          }

          // Generate embedding for the email with delay
          const textForEmbedding = `${subject}\n\n${body}`.slice(0, 8000);
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit OpenAI
          const embedding = await generateEmbedding(textForEmbedding);

          // Create email in database
          const email = await storage.createEmail({
            gmailId: message.id,
            subject,
            from,
            to,
            body,
            snippet: fullMessage.data.snippet || '',
            receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
            embedding,
          });

          // Auto-classify if possible
          const categorizedEmails = await storage.getEmailsWithEmbeddings();
          const emailsWithCategories = [];
          
          for (const catEmail of categorizedEmails) {
            const classification = await storage.getClassificationByEmailId(catEmail.id);
            if (classification && catEmail.embedding) {
              emailsWithCategories.push({
                embedding: catEmail.embedding,
                categoryId: classification.categoryId,
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
                isManual: 0,
              });
            }
          }

          newCount++;
          syncedCount++;
        } catch (emailError: any) {
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
    } catch (error: any) {
      console.error("Error syncing emails:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Classify a specific email
  app.post("/api/emails/:id/classify", async (req, res) => {
    try {
      const { categoryId, isManual } = req.body;
      
      if (!categoryId) {
        return res.status(400).json({ error: "categoryId is required" });
      }

      const email = await storage.getEmailById(req.params.id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }

      // Check if classification exists
      const existingClassification = await storage.getClassificationByEmailId(email.id);
      
      if (existingClassification) {
        // Update existing
        await storage.updateClassification(email.id, {
          categoryId,
          confidence: isManual ? 1.0 : existingClassification.confidence,
          isManual: isManual ? 1 : 0,
        });
      } else {
        // Create new
        await storage.createClassification({
          emailId: email.id,
          categoryId,
          confidence: isManual ? 1.0 : 0.5,
          isManual: isManual ? 1 : 0,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error classifying email:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Recompute embeddings for all emails
  app.post("/api/emails/compute-embeddings", async (req, res) => {
    try {
      const emails = await storage.getEmails();
      let processed = 0;

      for (const email of emails) {
        if (!email.embedding || email.embedding.length === 0) {
          const textForEmbedding = `${email.subject}\n\n${email.body || email.snippet}`.slice(0, 8000);
          const embedding = await generateEmbedding(textForEmbedding);
          await storage.updateEmail(email.id, { embedding });
          processed++;
        }
      }

      res.json({ success: true, processed });
    } catch (error: any) {
      console.error("Error computing embeddings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
