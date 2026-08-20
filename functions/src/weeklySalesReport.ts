/* eslint-disable require-jsdoc */
import ExcelJS from "exceljs";
import {getFirestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {onSchedule} from "firebase-functions/v2/scheduler";

import {
  FirestoreDeliveryRecordRepository,
} from "./firestoreDeliveryRepository.js";
import {executeRecordedDelivery} from "./messageDeliveryService.js";
import {
  createMessagingProvidersFromEnvironment,
} from "./messagingProviders.js";
import {
  EMAIL_MESSAGING_SECRETS,
  emailMessagingEnvironment,
} from "./messagingRuntimeConfig.js";

type EntityData = Record<string, unknown>;

export type WeeklyReportDelivery = (
  recipient: string,
  subject: string,
  body: string,
  idempotencyKey: string
) => Promise<string>;

export type WeeklyReportExport = (
  path: string,
  content: Buffer
) => Promise<void>;

const REPORT_CONFIG_PATH = "entities/ReportConfig/records";
const PROFILE_PATH = "userProfiles";
const RUN_PATH = "system/weeklySalesReports/runs";
const CENTRAL_TIME_ZONE = "America/Chicago";

function readString(data: EntityData, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function validEntityName(value: string | null): value is string {
  return Boolean(value && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value));
}

function centralDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CENTRAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function mondayKey(date: Date): string {
  const localKey = centralDateKey(date);
  const localDate = new Date(`${localKey}T12:00:00.000Z`);
  const day = localDate.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  localDate.setUTCDate(localDate.getUTCDate() + delta);
  return localDate.toISOString().slice(0, 10);
}

function configObject(data: EntityData): EntityData {
  return data.config && typeof data.config === "object" &&
    !Array.isArray(data.config) ? data.config as EntityData : {};
}

function configuredFields(config: EntityData): string[] {
  const fields = config.fields;
  if (!Array.isArray(fields)) return ["id", "created_date"];
  const safe = fields.filter((field): field is string =>
    typeof field === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(field)
  ).slice(0, 50);
  return safe.length > 0 ? safe : ["id", "created_date"];
}

async function managementRecipients(): Promise<string[]> {
  const snapshot = await getFirestore().collection(PROFILE_PATH).get();
  return [...new Set(snapshot.docs.map((document) => document.data())
    .filter((profile) => {
      const role = readString(
        profile, "application_role", "appRole", "role"
      );
      const status = (readString(
        profile, "account_status", "accountStatus", "status"
      ) ?? (profile.active === false ? "inactive" : "active")).toLowerCase();
      return status === "active" && (
        role === "administrator" || role === "admin" ||
        role === "super_admin"
      );
    })
    .map((profile) => readString(profile, "email"))
    .filter((email): email is string => Boolean(email)))].sort();
}

async function buildReport(): Promise<{
  summary: string;
  workbook: Buffer;
  configCount: number;
}> {
  const firestore = getFirestore();
  const configs = await firestore.collection(REPORT_CONFIG_PATH).get();
  const workbook = new ExcelJS.Workbook();
  const sections: string[] = [];
  let sheetIndex = 0;

  for (const document of configs.docs) {
    const data = document.data();
    const entityName = readString(data, "entity_type");
    if (!validEntityName(entityName)) continue;
    const records = await firestore.collection(
      `entities/${entityName}/records`
    ).get();
    const config = configObject(data);
    const fields = configuredFields(config);
    const yAxis = readString(config, "yAxis");
    const aggregation = readString(config, "aggregation");
    const values: EntityData[] = records.docs.map((record) => ({
      id: record.id,
      ...record.data(),
    }));
    let section = `### ${readString(data, "name") ?? entityName}` +
      ` (${entityName})\nTotal records: ${values.length}`;
    if (yAxis && aggregation === "sum") {
      const sum = values.reduce(
        (total, value) => total + (Number(value[yAxis]) || 0), 0
      );
      section += `\nSum of ${yAxis}: ${sum}`;
    } else if (yAxis && aggregation === "avg") {
      const total = values.reduce(
        (sum, value) => sum + (Number(value[yAxis]) || 0), 0
      );
      section += `\nAvg of ${yAxis}: ${
        values.length ? (total / values.length).toFixed(2) : "0.00"
      }`;
    }
    sections.push(section);

    const sheetName = (readString(data, "name") ?? entityName)
      .replace(/[\\/*?:[\]]/g, " ").slice(0, 27) || "Report";
    const sheet = workbook.addWorksheet(`${sheetName}-${++sheetIndex}`);
    sheet.columns = fields.map((field) => ({
      header: field,
      key: field,
      width: 20,
    }));
    for (const value of values) {
      const row: EntityData = {};
      for (const field of fields) row[field] = value[field] ?? null;
      sheet.addRow(row);
    }
  }

  if (workbook.worksheets.length === 0) {
    const sheet = workbook.addWorksheet("Summary");
    sheet.addRow(["No report configurations found."]);
  }
  const output = await workbook.xlsx.writeBuffer();
  return {
    summary: sections.join("\n\n") || "No report configurations found.",
    workbook: Buffer.from(output),
    configCount: configs.size,
  };
}

async function defaultExport(path: string, content: Buffer): Promise<void> {
  await getStorage().bucket().file(path).save(content, {
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    metadata: {
      cacheControl: "private, no-store",
      metadata: {serverControlled: "true", reportType: "weekly_sales"},
    },
  });
}

async function defaultDelivery(
  recipient: string,
  subject: string,
  body: string,
  idempotencyKey: string
): Promise<string> {
  const environment = emailMessagingEnvironment();
  const provider = createMessagingProvidersFromEnvironment(environment).email;
  const result = await executeRecordedDelivery(
    provider,
    {
      recipient,
      subject,
      message: body,
      idempotencyKey,
      sourceType: "WeeklySalesReport",
      sourceId: idempotencyKey,
    },
    new FirestoreDeliveryRecordRepository(getFirestore())
  );
  return result.record.status;
}

export async function processWeeklySalesReport(
  requestedNow: string,
  deliver: WeeklyReportDelivery = defaultDelivery,
  saveExport: WeeklyReportExport = defaultExport
): Promise<{
  weekKey: string;
  duplicate: boolean;
  recipients: number;
  sent: number;
  exportPath: string;
}> {
  const nowDate = new Date(requestedNow);
  if (Number.isNaN(nowDate.getTime())) throw new Error("Invalid report date.");
  const weekKey = mondayKey(nowDate);
  const runReference = getFirestore().collection(RUN_PATH).doc(weekKey);
  const existing = await runReference.get();
  if (existing.exists && existing.data()?.status === "completed") {
    return {
      weekKey,
      duplicate: true,
      recipients: Number(existing.data()?.recipient_count || 0),
      sent: Number(existing.data()?.sent_count || 0),
      exportPath: readString(existing.data() ?? {}, "export_path") ?? "",
    };
  }

  const [report, recipients] = await Promise.all([
    buildReport(), managementRecipients(),
  ]);
  const exportPath = `system/reports/weekly/${weekKey}.xlsx`;
  await saveExport(exportPath, report.workbook);
  const subject = `Weekly Sales Report — ${weekKey}`;
  const body = [
    `Weekly Sales Report for week of ${weekKey}`,
    "",
    report.summary,
    "",
    "The server-controlled Excel export was generated successfully.",
  ].join("\n");
  let sent = 0;
  const deliveryStatuses: Record<string, string> = {};
  for (const recipient of recipients) {
    const status = await deliver(
      recipient,
      subject,
      body,
      `weekly-sales-report:${weekKey}:${recipient.toLowerCase()}`
    );
    deliveryStatuses[recipient] = status;
    if (status === "sent") sent++;
  }
  await runReference.set({
    week_key: weekKey,
    status: "completed",
    report_config_count: report.configCount,
    recipient_count: recipients.length,
    sent_count: sent,
    delivery_statuses: deliveryStatuses,
    export_path: exportPath,
    generated_date: nowDate.toISOString(),
    created_date: nowDate.toISOString(),
    updated_date: nowDate.toISOString(),
    actor_user_id: "system",
  });
  return {
    weekKey,
    duplicate: false,
    recipients: recipients.length,
    sent,
    exportPath,
  };
}

export const generateWeeklySalesReport = onSchedule(
  {
    schedule: "0 9 * * 1",
    timeZone: CENTRAL_TIME_ZONE,
    region: "us-central1",
    retryCount: 3,
    secrets: EMAIL_MESSAGING_SECRETS,
  },
  async (event) => {
    await processWeeklySalesReport(event.scheduleTime);
  }
);
