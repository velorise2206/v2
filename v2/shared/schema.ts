import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default('#3b82f6'),
  icon: text("icon").notNull().default('Folder'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gmailId: text("gmail_id").notNull().unique(),
  subject: text("subject").notNull().default('(No Subject)'),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  body: text("body"),
  snippet: text("snippet"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  embedding: text("embedding"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classifications = pgTable("classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull().references(() => emails.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  confidence: real("confidence").notNull().default(0.5),
  isManual: boolean("is_manual").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  classifications: many(classifications),
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
}));

export const emailsRelations = relations(emails, ({ many, one }) => ({
  classifications: many(classifications),
  user: one(users, {
    fields: [emails.userId],
    references: [users.id],
  }),
}));

export const classificationsRelations = relations(classifications, ({ one }) => ({
  email: one(emails, {
    fields: [classifications.emailId],
    references: [emails.id],
  }),
  category: one(categories, {
    fields: [classifications.categoryId],
    references: [categories.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
});

export const insertClassificationSchema = createInsertSchema(classifications).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

export type Classification = typeof classifications.$inferSelect;
export type InsertClassification = z.infer<typeof insertClassificationSchema>;

export type EmailWithClassification = Email & {
  classification?: Classification & {
    category: Category;
  };
};

export type CategoryWithStats = Category & {
  emailCount: number;
  percentage: number;
};

export type SimilarEmail = {
  email: Email;
  similarity: number;
};
