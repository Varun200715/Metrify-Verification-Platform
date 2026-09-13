import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  businessName: text("business_name").notNull(),
  ownerName: text("owner_name").notNull(),
  address: text("address").notNull(),
  district: text("district").notNull(),
  state: text("state").notNull(),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  registrationNumber: text("registration_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instrumentsTable = pgTable("instruments", {
  id: serial("id").primaryKey(),
  instrumentId: text("instrument_id").notNull().unique(),
  businessId: integer("business_id"),
  businessName: text("business_name").notNull(),
  instrumentType: text("instrument_type").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number").notNull(),
  capacity: text("capacity").notNull(),
  accuracyClass: text("accuracy_class").notNull(),
  location: text("location").notNull(),
  state: text("state").notNull(),
  district: text("district").notNull(),
  status: text("status").notNull().default("PENDING VERIFICATION"),
  verificationDate: date("verification_date", { mode: "string" }),
  expiryDate: date("expiry_date", { mode: "string" }),
  qrToken: text("qr_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applicationsTable = pgTable("verification_applications", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  applicationNumber: text("application_number").notNull().unique(),
  applicationDate: date("application_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("SUBMITTED"),
  assignedOfficerId: integer("assigned_officer_id"),
  inspectionDate: date("inspection_date", { mode: "string" }),
  certificateStatus: text("certificate_status").notNull().default("NOT ISSUED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  officerId: integer("officer_id"),
  inspectionDate: date("inspection_date", { mode: "string" }).notNull(),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  gpsVerified: boolean("gps_verified").notNull().default(false),
  inspectionResult: text("inspection_result").notNull().default("PENDING"),
  observations: text("observations").notNull().default(""),
  photos: jsonb("photos").$type<string[]>().notNull().default([]),
  ocrData: jsonb("ocr_data").$type<Record<string, unknown> | null>(),
  syncStatus: text("sync_status").notNull().default("SYNCED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ocrResultsTable = pgTable("ocr_results", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  serialNumber: text("serial_number").notNull(),
  capacity: text("capacity").notNull(),
  accuracyClass: text("accuracy_class").notNull(),
  confidence: numeric("confidence").notNull(),
  mismatchDetected: boolean("mismatch_detected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  inspectionId: integer("inspection_id").notNull(),
  certificateNumber: text("certificate_number").notNull().unique(),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  expiryDate: date("expiry_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("VERIFIED"),
  verificationHash: text("verification_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const riskSignalsTable = pgTable("risk_signals", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  score: integer("score").notNull(),
  level: text("level").notNull(),
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  instrumentId: integer("instrument_id").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type Instrument = typeof instrumentsTable.$inferSelect;
export type Application = typeof applicationsTable.$inferSelect;
export type Inspection = typeof inspectionsTable.$inferSelect;
export type Certificate = typeof certificatesTable.$inferSelect;
export type RiskSignal = typeof riskSignalsTable.$inferSelect;