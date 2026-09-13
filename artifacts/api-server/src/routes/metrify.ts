import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  applicationsTable,
  auditLogsTable,
  businessesTable,
  certificatesTable,
  feedbackTable,
  inspectionsTable,
  instrumentsTable,
  ocrResultsTable,
  riskSignalsTable,
  usersTable,
} from "@workspace/db";
import {
  AnalyzeOcrBody,
  AnalyzeOcrResponse,
  CreateApplicationBody,
  CreateApplicationResponse,
  CreateCertificateBody,
  CreateCertificateResponse,
  CreateFeedbackBody,
  CreateFeedbackResponse,
  CreateInspectionBody,
  CreateInspectionResponse,
  CreateInstrumentBody,
  CreateInstrumentResponse,
  GetAdminDashboardResponse,
  GetBusinessDashboardResponse,
  GetCertificateParams,
  GetCertificateResponse,
  GetInstrumentParams,
  GetInstrumentResponse,
  GetLmoDashboardResponse,
  GetRiskSignalParams,
  GetRiskSignalResponse,
  GetInspectionParams,
  GetInspectionResponse,
  ListApplicationsResponse,
  ListAuditLogsResponse,
  ListCertificatesResponse,
  ListFeedbackResponse,
  ListInstrumentsQueryParams,
  ListInstrumentsResponse,
  ListInspectionsResponse,
  ListRiskSignalsResponse,
  LoginBody,
  LoginResponse,
  RegisterBusinessBody,
  RegisterBusinessResponse,
  UpdateApplicationBody,
  UpdateApplicationParams,
  UpdateApplicationResponse,
  UpdateInspectionBody,
  UpdateInspectionParams,
  UpdateInspectionResponse,
  UpdateInstrumentBody,
  UpdateInstrumentParams,
  UpdateInstrumentResponse,
  VerifyPublicInstrumentParams,
  VerifyPublicInstrumentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
let demoSeeded = false;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const signedToken = (value: string) =>
  crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "metrify-demo").update(value).digest("hex");

const mapInstrument = (instrument: typeof instrumentsTable.$inferSelect) => ({
  id: instrument.id,
  instrumentId: instrument.instrumentId,
  businessName: instrument.businessName,
  instrumentType: instrument.instrumentType,
  manufacturer: instrument.manufacturer,
  model: instrument.model,
  serialNumber: instrument.serialNumber,
  capacity: instrument.capacity,
  accuracyClass: instrument.accuracyClass,
  location: instrument.location,
  district: instrument.district,
  state: instrument.state,
  status: instrument.status,
  verificationDate: instrument.verificationDate,
  expiryDate: instrument.expiryDate,
  qrToken: instrument.qrToken,
});

const mapInspection = (
  inspection: typeof inspectionsTable.$inferSelect,
  instrument?: typeof instrumentsTable.$inferSelect,
) => ({
  id: inspection.id,
  instrumentId: inspection.instrumentId,
  instrumentCode: instrument?.instrumentId ?? `MTR-2026-${String(inspection.instrumentId).padStart(6, "0")}`,
  businessName: instrument?.businessName ?? "Metrify Demo Business",
  instrumentType: instrument?.instrumentType ?? "Measuring Instrument",
  district: instrument?.district ?? "Madurai",
  inspectionDate: inspection.inspectionDate,
  priority: inspection.inspectionResult === "REQUIRES REVIEW" ? "HIGH" : "MEDIUM",
  result: inspection.inspectionResult,
  observations: inspection.observations,
  gpsVerified: inspection.gpsVerified,
  latitude: inspection.latitude ? Number(inspection.latitude) : null,
  longitude: inspection.longitude ? Number(inspection.longitude) : null,
  syncStatus: inspection.syncStatus,
  ocrMismatch: Boolean(inspection.ocrData && (inspection.ocrData as Record<string, unknown>).mismatchDetected),
});

const metricsFor = (
  instruments: Array<typeof instrumentsTable.$inferSelect>,
  risks: Array<typeof riskSignalsTable.$inferSelect>,
  inspections: Array<typeof inspectionsTable.$inferSelect>,
) => ({
  totalInstruments: instruments.length,
  verified: instruments.filter((item) => item.status === "VERIFIED").length,
  pending: instruments.filter((item) => item.status === "PENDING VERIFICATION").length,
  expired: instruments.filter((item) => item.status === "EXPIRED").length,
  highPriority: risks.filter((item) => item.level === "HIGH").length,
  inspectionsDue: inspections.filter((item) => item.inspectionResult === "PENDING").length,
});

const ensureDemoSeed = async () => {
  if (demoSeeded) return;
  const existing = await db.select({ id: instrumentsTable.id }).from(instrumentsTable).limit(1);
  if (existing.length > 0) {
    demoSeeded = true;
    return;
  }

  const demoUsers = await db
    .insert(usersTable)
    .values([
      { name: "Ravi Kumar", email: "business@metrify.demo", passwordHash: hash("Metrify@123"), role: "BUSINESS", phone: "+91 90000 00001" },
      { name: "Anita Menon", email: "lmo@metrify.demo", passwordHash: hash("Metrify@123"), role: "LMO", phone: "+91 90000 00002" },
      { name: "Metrify Authority", email: "admin@metrify.demo", passwordHash: hash("Metrify@123"), role: "ADMIN", phone: "+91 90000 00003" },
    ])
    .returning();

  const businessNames = [
    "Sri Lakshmi Stores",
    "Annapoorna Supermarket",
    "Metro Wholesale",
    "Green Valley Traders",
    "Chennai Market Traders",
  ];
  const businesses = await db
    .insert(businessesTable)
    .values(
      businessNames.map((businessName, index) => ({
        userId: demoUsers[0].id,
        businessName,
        ownerName: "Demo Business Owner",
        address: `${index + 10} Market Road`,
        district: ["Madurai", "Coimbatore", "Chennai", "Salem", "Tiruchirappalli"][index],
        state: "Tamil Nadu",
        latitude: String(9.92 + index * 0.08),
        longitude: String(78.12 + index * 0.12),
        registrationNumber: `TN-MET-${String(index + 1).padStart(4, "0")}`,
      })),
    )
    .returning();

  const instrumentTypes = ["Digital Weighing Scale", "Platform Scale", "Retail Weighing Scale"];
  const seededInstruments = await db
    .insert(instrumentsTable)
    .values(
      Array.from({ length: 15 }, (_, index) => {
        const verified = index < 8;
        const business = businesses[index % businesses.length];
        return {
          instrumentId: `MTR-2026-${String(index + 1).padStart(6, "0")}`,
          businessId: business.id,
          businessName: business.businessName,
          instrumentType: instrumentTypes[index % instrumentTypes.length],
          manufacturer: ["Example Instruments", "Precision Works", "MeasureWell"][index % 3],
          model: ["DS-30", "PW-60", "MW-100"][index % 3],
          serialNumber: `WT-${45892 + index}`,
          capacity: ["30 kg", "60 kg", "100 kg"][index % 3],
          accuracyClass: ["III", "II", "III"][index % 3],
          location: business.address,
          state: business.state,
          district: business.district,
          status: verified ? "VERIFIED" : index > 11 ? "EXPIRED" : "PENDING VERIFICATION",
          verificationDate: verified ? addDays(-index * 12) : null,
          expiryDate: verified ? addDays(365 - index * 12) : index > 11 ? addDays(-10) : null,
          qrToken: verified ? signedToken(`MTR-2026-${String(index + 1).padStart(6, "0")}`) : null,
        };
      }),
    )
    .returning();

  const seededApplications = await db
    .insert(applicationsTable)
    .values(
      seededInstruments.slice(0, 10).map((instrument, index) => ({
        instrumentId: instrument.id,
        applicationNumber: `MTR-APP-2026-${String(index + 1).padStart(6, "0")}`,
        applicationDate: addDays(-45 + index),
        status: index < 5 ? "VERIFIED" : index < 8 ? "INSPECTION SCHEDULED" : "SUBMITTED",
        assignedOfficerId: index < 8 ? demoUsers[1].id : null,
        inspectionDate: index < 8 ? addDays(-12 + index) : null,
        certificateStatus: index < 5 ? "ISSUED" : "NOT ISSUED",
      })),
    )
    .returning();

  const seededInspections = await db
    .insert(inspectionsTable)
    .values(
      seededInstruments.slice(0, 10).map((instrument, index) => ({
        instrumentId: instrument.id,
        officerId: demoUsers[1].id,
        inspectionDate: addDays(-12 + index),
        latitude: String(9.92 + (index % 5) * 0.08),
        longitude: String(78.12 + (index % 5) * 0.12),
        gpsVerified: index !== 6,
        inspectionResult: index < 6 ? "PASS" : index === 6 ? "REQUIRES REVIEW" : "PENDING",
        observations: index === 6 ? "Nameplate serial requires officer review." : "Instrument inspected at registered premises.",
        syncStatus: "SYNCED",
        ocrData: index === 6 ? { mismatchDetected: true } : null,
      })),
    )
    .returning();

  await db.insert(certificatesTable).values(
    seededInstruments.slice(0, 8).map((instrument, index) => ({
      instrumentId: instrument.id,
      inspectionId: seededInspections[index % seededInspections.length].id,
      certificateNumber: `LMO/2026/${String(index + 1).padStart(6, "0")}`,
      issueDate: addDays(-index * 12),
      expiryDate: addDays(365 - index * 12),
      status: "VERIFIED",
      verificationHash: signedToken(`certificate-${instrument.instrumentId}`),
    })),
  );

  await db.insert(riskSignalsTable).values(
    seededInstruments.slice(0, 10).map((instrument, index) => ({
      instrumentId: instrument.id,
      score: index === 6 ? 88 : index > 7 ? 58 : 18 + index * 4,
      level: index === 6 ? "HIGH" : index > 7 ? "MEDIUM" : "LOW",
      reasons: index === 6 ? ["OCR mismatch", "GPS location mismatch"] : index > 7 ? ["Inspection pending"] : ["Routine monitoring"],
    })),
  );

  await db.insert(feedbackTable).values(
    seededInstruments.slice(0, 5).map((instrument, index) => ({
      instrumentId: instrument.id,
      category: ["QR/tag issue", "Damaged instrument", "Other"][index % 3],
      message: ["QR label is fading", "Housing needs inspection", "Customer requested a re-check"][index % 3],
    })),
  );

  await db.insert(auditLogsTable).values([
    { userId: demoUsers[0].id, action: "Business registered instrument", entityType: "Instrument", entityId: seededInstruments[0].instrumentId },
    { userId: demoUsers[1].id, action: "LMO submitted inspection", entityType: "Inspection", entityId: String(seededInspections[0].id) },
    { userId: demoUsers[2].id, action: "Certificate generated", entityType: "Certificate", entityId: "LMO/2026/000001" },
  ]);
  void seededApplications;
  demoSeeded = true;
};

const allInstruments = async () => db.select().from(instrumentsTable).orderBy(desc(instrumentsTable.createdAt));
const allRisks = async () => db.select().from(riskSignalsTable);
const allInspections = async () => db.select().from(inspectionsTable).orderBy(desc(inspectionsTable.inspectionDate));
const instrumentById = async (id: number) => {
  const rows = await db.select().from(instrumentsTable).where(eq(instrumentsTable.id, id));
  return rows[0];
};

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureDemoSeed();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user || user.passwordHash !== hash(parsed.data.password)) {
    res.status(401).json({ error: "Invalid demo credentials" });
    return;
  }
  const response = { token: signedToken(`${user.email}:${user.role}`), user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } };
  res.json(LoginResponse.parse(response));
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: hash(parsed.data.password),
    role: "BUSINESS",
    phone: parsed.data.phone ?? null,
  }).returning();
  const [business] = await db.insert(businessesTable).values({
    userId: user.id,
    businessName: parsed.data.businessName,
    ownerName: parsed.data.name,
    address: "Address to be updated",
    district: "Madurai",
    state: "Tamil Nadu",
    registrationNumber: `TN-MET-${Date.now().toString().slice(-4)}`,
  }).returning();
  void business;
  res.status(201).json(RegisterBusinessResponse.parse({
    token: signedToken(`${user.email}:${user.role}`),
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
  }));
});

router.get("/dashboard/business", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [instruments, risks, inspections, applications] = await Promise.all([allInstruments(), allRisks(), allInspections(), db.select().from(applicationsTable).orderBy(desc(applicationsTable.createdAt))]);
  const instrumentMap = new Map(instruments.map((item) => [item.id, item]));
  const appResponse = applications.slice(0, 6).map((application) => {
    const instrument = instrumentMap.get(application.instrumentId);
    return { id: application.id, applicationNumber: application.applicationNumber, instrumentId: application.instrumentId, instrumentCode: instrument?.instrumentId ?? "", businessName: instrument?.businessName ?? "", date: application.applicationDate, status: application.status, assignedOfficer: application.assignedOfficerId ? "Anita Menon" : null, inspectionDate: application.inspectionDate, certificateStatus: application.certificateStatus };
  });
  res.json(GetBusinessDashboardResponse.parse({ metrics: metricsFor(instruments, risks, inspections), recentApplications: appResponse, expiring: instruments.filter((item) => item.expiryDate && item.status === "VERIFIED").slice(0, 4).map(mapInstrument) }));
});

router.get("/dashboard/lmo", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [instruments, risks, inspections] = await Promise.all([allInstruments(), allRisks(), allInspections()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(GetLmoDashboardResponse.parse({ metrics: metricsFor(instruments, risks, inspections), assignedInspections: inspections.slice(0, 8).map((item) => mapInspection(item, map.get(item.instrumentId))), offlineQueue: 0 }));
});

router.get("/dashboard/admin", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [instruments, risks, inspections] = await Promise.all([allInstruments(), allRisks(), allInspections()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  const count = (values: string[]) => Array.from(new Set(values)).map((label) => ({ label, value: values.filter((value) => value === label).length }));
  res.json(GetAdminDashboardResponse.parse({
    metrics: metricsFor(instruments, risks, inspections),
    statusBreakdown: count(instruments.map((item) => item.status)),
    districtBreakdown: count(instruments.map((item) => item.district)),
    recentInspections: inspections.slice(0, 8).map((item) => mapInspection(item, map.get(item.instrumentId))),
    riskBreakdown: count(risks.map((item) => item.level)),
  }));
});

router.get("/instruments", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const query = ListInstrumentsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const instruments = await allInstruments();
  const filtered = query.data.status ? instruments.filter((item) => item.status === query.data.status) : instruments;
  res.json(ListInstrumentsResponse.parse(filtered.map(mapInstrument)));
});

router.post("/instruments", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = CreateInstrumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await allInstruments();
  const instrumentCode = `MTR-2026-${String(existing.length + 1).padStart(6, "0")}`;
  const [instrument] = await db.insert(instrumentsTable).values({
    instrumentId: instrumentCode,
    businessId: null,
    businessName: parsed.data.businessName,
    instrumentType: parsed.data.instrumentType,
    manufacturer: parsed.data.manufacturer,
    model: parsed.data.model,
    serialNumber: parsed.data.serialNumber,
    capacity: parsed.data.capacity,
    accuracyClass: parsed.data.accuracyClass,
    location: parsed.data.location,
    state: parsed.data.state,
    district: parsed.data.district,
    status: "PENDING VERIFICATION",
    verificationDate: null,
    expiryDate: null,
    qrToken: null,
  }).returning();
  await db.insert(applicationsTable).values({
    instrumentId: instrument.id,
    applicationNumber: `MTR-APP-2026-${String(existing.length + 1).padStart(6, "0")}`,
    applicationDate: today(),
    status: "SUBMITTED",
    certificateStatus: "NOT ISSUED",
  });
  res.status(201).json(CreateInstrumentResponse.parse(mapInstrument(instrument)));
});

router.get("/instruments/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = GetInstrumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const instrument = await instrumentById(params.data.id);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [applications, inspections, certificates] = await Promise.all([
    db.select().from(applicationsTable).where(eq(applicationsTable.instrumentId, instrument.id)),
    db.select().from(inspectionsTable).where(eq(inspectionsTable.instrumentId, instrument.id)),
    db.select().from(certificatesTable).where(eq(certificatesTable.instrumentId, instrument.id)),
  ]);
  const applicationResponse = applications.map((application) => ({ id: application.id, applicationNumber: application.applicationNumber, instrumentId: application.instrumentId, instrumentCode: instrument.instrumentId, businessName: instrument.businessName, date: application.applicationDate, status: application.status, assignedOfficer: application.assignedOfficerId ? "Anita Menon" : null, inspectionDate: application.inspectionDate, certificateStatus: application.certificateStatus }));
  const response = { ...mapInstrument(instrument), applications: applicationResponse, inspections: inspections.map((item) => mapInspection(item, instrument)), certificates: certificates.map((item) => ({ id: item.id, instrumentId: item.instrumentId, instrumentCode: instrument.instrumentId, certificateNumber: item.certificateNumber, issueDate: item.issueDate, expiryDate: item.expiryDate, status: item.status, verificationHash: item.verificationHash })), timeline: ["REGISTERED", "APPLICATION SUBMITTED", ...(inspections.length ? ["INSPECTION"] : []), ...(instrument.status === "VERIFIED" ? ["VERIFIED", "QR ISSUED"] : [])] };
  res.json(GetInstrumentResponse.parse(response));
});

router.put("/instruments/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = UpdateInstrumentParams.safeParse(req.params);
  const body = UpdateInstrumentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid instrument update" });
    return;
  }
  const [instrument] = await db.update(instrumentsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(instrumentsTable.id, params.data.id)).returning();
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  res.json(UpdateInstrumentResponse.parse(mapInstrument(instrument)));
});

router.get("/applications", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [applications, instruments] = await Promise.all([db.select().from(applicationsTable).orderBy(desc(applicationsTable.createdAt)), allInstruments()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(ListApplicationsResponse.parse(applications.map((application) => {
    const instrument = map.get(application.instrumentId);
    return { id: application.id, applicationNumber: application.applicationNumber, instrumentId: application.instrumentId, instrumentCode: instrument?.instrumentId ?? "", businessName: instrument?.businessName ?? "", date: application.applicationDate, status: application.status, assignedOfficer: application.assignedOfficerId ? "Anita Menon" : null, inspectionDate: application.inspectionDate, certificateStatus: application.certificateStatus };
  })));
});

router.post("/applications", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const instrument = await instrumentById(parsed.data.instrumentId);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [application] = await db.insert(applicationsTable).values({ instrumentId: instrument.id, applicationNumber: `MTR-APP-2026-${Date.now().toString().slice(-6)}`, applicationDate: today(), status: "SUBMITTED", assignedOfficerId: parsed.data.assignedOfficerId ?? null, inspectionDate: parsed.data.inspectionDate ?? null, certificateStatus: "NOT ISSUED" }).returning();
  res.status(201).json(CreateApplicationResponse.parse({ id: application.id, applicationNumber: application.applicationNumber, instrumentId: instrument.id, instrumentCode: instrument.instrumentId, businessName: instrument.businessName, date: application.applicationDate, status: application.status, assignedOfficer: application.assignedOfficerId ? "Anita Menon" : null, inspectionDate: application.inspectionDate, certificateStatus: application.certificateStatus }));
});

router.put("/applications/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = UpdateApplicationParams.safeParse(req.params);
  const body = UpdateApplicationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid application update" });
    return;
  }
  const [application] = await db.update(applicationsTable).set(body.data).where(eq(applicationsTable.id, params.data.id)).returning();
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const instrument = await instrumentById(application.instrumentId);
  res.json(UpdateApplicationResponse.parse({ id: application.id, applicationNumber: application.applicationNumber, instrumentId: application.instrumentId, instrumentCode: instrument?.instrumentId ?? "", businessName: instrument?.businessName ?? "", date: application.applicationDate, status: application.status, assignedOfficer: application.assignedOfficerId ? "Anita Menon" : null, inspectionDate: application.inspectionDate, certificateStatus: application.certificateStatus }));
});

router.get("/inspections", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [inspections, instruments] = await Promise.all([allInspections(), allInstruments()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(ListInspectionsResponse.parse(inspections.map((item) => mapInspection(item, map.get(item.instrumentId)))));
});

router.post("/inspections", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = CreateInspectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const instrument = await instrumentById(parsed.data.instrumentId);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [inspection] = await db.insert(inspectionsTable).values({ instrumentId: instrument.id, officerId: null, inspectionDate: today(), latitude: parsed.data.latitude ? String(parsed.data.latitude) : null, longitude: parsed.data.longitude ? String(parsed.data.longitude) : null, gpsVerified: parsed.data.gpsVerified, inspectionResult: parsed.data.result, observations: parsed.data.observations, ocrData: parsed.data.ocrData ? JSON.parse(parsed.data.ocrData) : null, syncStatus: parsed.data.syncStatus ?? "SYNCED" }).returning();
  if (parsed.data.result === "PASS") {
    await db.update(instrumentsTable).set({ status: "VERIFIED", verificationDate: today(), expiryDate: addDays(365), qrToken: signedToken(instrument.instrumentId), updatedAt: new Date() }).where(eq(instrumentsTable.id, instrument.id));
  }
  res.status(201).json(CreateInspectionResponse.parse(mapInspection(inspection, instrument)));
});

router.get("/inspections/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = GetInspectionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [inspection] = await db.select().from(inspectionsTable).where(eq(inspectionsTable.id, params.data.id));
  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }
  res.json(GetInspectionResponse.parse(mapInspection(inspection, await instrumentById(inspection.instrumentId))));
});

router.put("/inspections/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = UpdateInspectionParams.safeParse(req.params);
  const body = UpdateInspectionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid inspection update" });
    return;
  }
  const [inspection] = await db.update(inspectionsTable).set({ ...body.data, ocrData: body.data.ocrData ? JSON.parse(body.data.ocrData) : undefined }).where(eq(inspectionsTable.id, params.data.id)).returning();
  if (!inspection) {
    res.status(404).json({ error: "Inspection not found" });
    return;
  }
  res.json(UpdateInspectionResponse.parse(mapInspection(inspection, await instrumentById(inspection.instrumentId))));
});

router.post("/ocr/analyze", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = AnalyzeOcrBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const instrument = await instrumentById(parsed.data.instrumentId);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const response = { manufacturer: instrument.manufacturer, model: instrument.model, serialNumber: instrument.serialNumber, capacity: instrument.capacity, accuracyClass: instrument.accuracyClass, confidence: 0.96, mismatchDetected: false };
  await db.insert(ocrResultsTable).values({ instrumentId: instrument.id, ...response, confidence: String(response.confidence) });
  res.json(AnalyzeOcrResponse.parse(response));
});

router.get("/certificates", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [certificates, instruments] = await Promise.all([db.select().from(certificatesTable).orderBy(desc(certificatesTable.createdAt)), allInstruments()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(ListCertificatesResponse.parse(certificates.map((certificate) => ({ id: certificate.id, instrumentId: certificate.instrumentId, instrumentCode: map.get(certificate.instrumentId)?.instrumentId ?? "", certificateNumber: certificate.certificateNumber, issueDate: certificate.issueDate, expiryDate: certificate.expiryDate, status: certificate.status, verificationHash: certificate.verificationHash }))));
});

router.post("/certificates", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = CreateCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const instrument = await instrumentById(parsed.data.instrumentId);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [certificate] = await db.insert(certificatesTable).values({ instrumentId: instrument.id, inspectionId: parsed.data.inspectionId, certificateNumber: `LMO/2026/${Date.now().toString().slice(-6)}`, issueDate: today(), expiryDate: addDays(365), status: "VERIFIED", verificationHash: signedToken(`certificate-${instrument.instrumentId}`) }).returning();
  await db.update(instrumentsTable).set({ status: "VERIFIED", verificationDate: today(), expiryDate: addDays(365), qrToken: signedToken(instrument.instrumentId), updatedAt: new Date() }).where(eq(instrumentsTable.id, instrument.id));
  res.status(201).json(CreateCertificateResponse.parse({ id: certificate.id, instrumentId: certificate.instrumentId, instrumentCode: instrument.instrumentId, certificateNumber: certificate.certificateNumber, issueDate: certificate.issueDate, expiryDate: certificate.expiryDate, status: certificate.status, verificationHash: certificate.verificationHash }));
});

router.get("/certificates/:id", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = GetCertificateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [certificate] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, params.data.id));
  if (!certificate) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }
  const instrument = await instrumentById(certificate.instrumentId);
  res.json(GetCertificateResponse.parse({ id: certificate.id, instrumentId: certificate.instrumentId, instrumentCode: instrument?.instrumentId ?? "", certificateNumber: certificate.certificateNumber, issueDate: certificate.issueDate, expiryDate: certificate.expiryDate, status: certificate.status, verificationHash: certificate.verificationHash }));
});

router.get("/public/verify/:instrumentId", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = VerifyPublicInstrumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [instrument] = await db.select().from(instrumentsTable).where(eq(instrumentsTable.instrumentId, params.data.instrumentId));
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [certificate] = await db.select().from(certificatesTable).where(eq(certificatesTable.instrumentId, instrument.id)).orderBy(desc(certificatesTable.createdAt)).limit(1);
  const inspections = await db.select().from(inspectionsTable).where(eq(inspectionsTable.instrumentId, instrument.id)).orderBy(desc(inspectionsTable.inspectionDate));
  res.json(VerifyPublicInstrumentResponse.parse({ instrument: mapInstrument(instrument), certificate: certificate ? { id: certificate.id, instrumentId: certificate.instrumentId, instrumentCode: instrument.instrumentId, certificateNumber: certificate.certificateNumber, issueDate: certificate.issueDate, expiryDate: certificate.expiryDate, status: certificate.status, verificationHash: certificate.verificationHash } : null, status: instrument.status, history: inspections.map((item) => mapInspection(item, instrument)) }));
});

router.get("/feedback", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [feedback, instruments] = await Promise.all([db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt)), allInstruments()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(ListFeedbackResponse.parse(feedback.map((item) => ({ id: item.id, instrumentId: item.instrumentId, instrumentCode: map.get(item.instrumentId)?.instrumentId ?? "", category: item.category, message: item.message, createdAt: item.createdAt.toISOString() }))));
});

router.post("/feedback", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const parsed = CreateFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const instrument = await instrumentById(parsed.data.instrumentId);
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const [feedback] = await db.insert(feedbackTable).values(parsed.data).returning();
  res.status(201).json(CreateFeedbackResponse.parse({ id: feedback.id, instrumentId: feedback.instrumentId, instrumentCode: instrument.instrumentId, category: feedback.category, message: feedback.message, createdAt: feedback.createdAt.toISOString() }));
});

router.get("/risk", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [risks, instruments] = await Promise.all([allRisks(), allInstruments()]);
  const map = new Map(instruments.map((item) => [item.id, item]));
  res.json(ListRiskSignalsResponse.parse(risks.map((risk) => ({ id: risk.id, instrumentId: risk.instrumentId, instrumentCode: map.get(risk.instrumentId)?.instrumentId ?? "", businessName: map.get(risk.instrumentId)?.businessName ?? "", score: risk.score, level: risk.level, reasons: risk.reasons, calculatedAt: risk.calculatedAt.toISOString() }))));
});

router.get("/risk/:instrumentId", async (req, res): Promise<void> => {
  await ensureDemoSeed();
  const params = GetRiskSignalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const instrument = (await db.select().from(instrumentsTable).where(eq(instrumentsTable.instrumentId, params.data.instrumentId)))[0];
  if (!instrument) {
    res.status(404).json({ error: "Instrument not found" });
    return;
  }
  const risk = (await db.select().from(riskSignalsTable).where(eq(riskSignalsTable.instrumentId, instrument.id)).limit(1))[0];
  if (!risk) {
    res.status(404).json({ error: "Risk signal not found" });
    return;
  }
  res.json(GetRiskSignalResponse.parse({ id: risk.id, instrumentId: risk.instrumentId, instrumentCode: instrument.instrumentId, businessName: instrument.businessName, score: risk.score, level: risk.level, reasons: risk.reasons, calculatedAt: risk.calculatedAt.toISOString() }));
});

router.get("/audit-logs", async (_req, res): Promise<void> => {
  await ensureDemoSeed();
  const [logs, users] = await Promise.all([db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.timestamp)), db.select().from(usersTable)]);
  const map = new Map(users.map((user) => [user.id, user.name]));
  res.json(ListAuditLogsResponse.parse(logs.map((log) => ({ id: log.id, user: log.userId ? map.get(log.userId) ?? "System" : "System", action: log.action, entity: `${log.entityType} ${log.entityId}`, timestamp: log.timestamp.toISOString() }))));
});

export default router;