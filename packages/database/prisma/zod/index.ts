/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'twoFactorEnabled', 'lastActiveOrganizationId'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'verified', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId', 'createdAt'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'customerId', 'subscriptionId', 'priceId', 'status', 'createdAt', 'updatedAt'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: NotificationScalarFieldEnum.schema.ts

export const NotificationScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'data', 'link', 'read', 'createdAt', 'updatedAt'])

export type NotificationScalarFieldEnum = z.infer<typeof NotificationScalarFieldEnumSchema>;

// File: UserNotificationPreferenceScalarFieldEnum.schema.ts

export const UserNotificationPreferenceScalarFieldEnumSchema = z.enum(['id', 'userId', 'type', 'target', 'createdAt'])

export type UserNotificationPreferenceScalarFieldEnum = z.infer<typeof UserNotificationPreferenceScalarFieldEnumSchema>;

// File: XiaofeiWorkspaceScalarFieldEnum.schema.ts

export const XiaofeiWorkspaceScalarFieldEnumSchema = z.enum(['id', 'tenantKey', 'snapshot', 'createdAt', 'updatedAt'])

export type XiaofeiWorkspaceScalarFieldEnum = z.infer<typeof XiaofeiWorkspaceScalarFieldEnumSchema>;

// File: XiaofeiConversationScalarFieldEnum.schema.ts

export const XiaofeiConversationScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'externalId', 'customerName', 'status', 'assignedUserId', 'assignedUserName', 'state', 'messages', 'traceEvents', 'lastCustomerSeenAt', 'lastMessageAt', 'createdAt', 'updatedAt'])

export type XiaofeiConversationScalarFieldEnum = z.infer<typeof XiaofeiConversationScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeDocumentScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeDocumentScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceType', 'originalFileName', 'mimeType', 'fileType', 'sourceUrl', 'fileSizeBytes', 'provider', 'parserVersion', 'category', 'bodyText', 'contentHash', 'sourceVersion', 'fetchedAt', 'parseStatus', 'parseError', 'status', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeDocumentScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeDocumentScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeEntryScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeEntryScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceId', 'sourceContentHash', 'sourceVersion', 'question', 'answer', 'similarQueries', 'category', 'tags', 'status', 'entryVersion', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeEntryScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeEntryScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeUnitScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeUnitScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceId', 'sourceContentHash', 'sourceVersion', 'entryId', 'entryVersion', 'title', 'content', 'status', 'eligibility', 'staleReason', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeUnitScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeUnitScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: NotificationType.schema.ts

export const NotificationTypeSchema = z.enum(['WELCOME', 'APP_UPDATE'])

export type NotificationType = z.infer<typeof NotificationTypeSchema>;

// File: NotificationTarget.schema.ts

export const NotificationTargetSchema = z.enum(['IN_APP', 'EMAIL'])

export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;

// File: XiaofeiKnowledgeDocumentSourceType.schema.ts

export const XiaofeiKnowledgeDocumentSourceTypeSchema = z.enum(['FILE', 'WEB', 'MANUAL'])

export type XiaofeiKnowledgeDocumentSourceType = z.infer<typeof XiaofeiKnowledgeDocumentSourceTypeSchema>;

// File: XiaofeiKnowledgeDocumentFileType.schema.ts

export const XiaofeiKnowledgeDocumentFileTypeSchema = z.enum(['MARKDOWN', 'TEXT', 'DOCX', 'PDF', 'XLSX'])

export type XiaofeiKnowledgeDocumentFileType = z.infer<typeof XiaofeiKnowledgeDocumentFileTypeSchema>;

// File: XiaofeiKnowledgeDocumentCategory.schema.ts

export const XiaofeiKnowledgeDocumentCategorySchema = z.enum(['PRESALES', 'POSTSALES'])

export type XiaofeiKnowledgeDocumentCategory = z.infer<typeof XiaofeiKnowledgeDocumentCategorySchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
  lastActiveOrganizationId: z.string().nullish(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  verified: z.boolean(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
  createdAt: z.date(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  customerId: z.string(),
  subscriptionId: z.string().nullish(),
  priceId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: Notification.schema.ts

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  data: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  link: z.string().nullish(),
  read: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type NotificationModel = z.infer<typeof NotificationSchema>;

// File: UserNotificationPreference.schema.ts

export const UserNotificationPreferenceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  target: NotificationTargetSchema,
  createdAt: z.date(),
});

export type UserNotificationPreferenceType = z.infer<typeof UserNotificationPreferenceSchema>;


// File: XiaofeiWorkspace.schema.ts

export const XiaofeiWorkspaceSchema = z.object({
  id: z.string(),
  tenantKey: z.string(),
  snapshot: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiWorkspaceType = z.infer<typeof XiaofeiWorkspaceSchema>;


// File: XiaofeiConversation.schema.ts

export const XiaofeiConversationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  externalId: z.string(),
  customerName: z.string().nullish(),
  status: z.string().default("open"),
  assignedUserId: z.string().nullish(),
  assignedUserName: z.string().nullish(),
  state: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  messages: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  traceEvents: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  lastCustomerSeenAt: z.date().nullish(),
  lastMessageAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiConversationType = z.infer<typeof XiaofeiConversationSchema>;


// File: XiaofeiKnowledgeDocument.schema.ts

export const XiaofeiKnowledgeDocumentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceType: XiaofeiKnowledgeDocumentSourceTypeSchema.default("FILE"),
  originalFileName: z.string().nullish(),
  mimeType: z.string().nullish(),
  fileType: XiaofeiKnowledgeDocumentFileTypeSchema.nullish(),
  sourceUrl: z.string().nullish(),
  fileSizeBytes: z.number().int().nullish(),
  provider: z.string().nullish(),
  parserVersion: z.string().nullish(),
  category: XiaofeiKnowledgeDocumentCategorySchema,
  bodyText: z.string(),
  contentHash: z.string().nullish(),
  sourceVersion: z.number().int().default(1),
  fetchedAt: z.date().nullish(),
  parseStatus: z.string().default("parsed"),
  parseError: z.string().nullish(),
  status: z.string().default("draft"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiKnowledgeDocumentType = z.infer<typeof XiaofeiKnowledgeDocumentSchema>;


// File: XiaofeiKnowledgeEntry.schema.ts

export const XiaofeiKnowledgeEntrySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceId: z.string().nullish(),
  sourceContentHash: z.string().nullish(),
  sourceVersion: z.number().int().nullish(),
  question: z.string(),
  answer: z.string(),
  similarQueries: z.array(z.string()),
  category: z.string().nullish(),
  tags: z.array(z.string()),
  status: z.string().default("draft"),
  entryVersion: z.number().int().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiKnowledgeEntryType = z.infer<typeof XiaofeiKnowledgeEntrySchema>;


// File: XiaofeiKnowledgeUnit.schema.ts

export const XiaofeiKnowledgeUnitSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  sourceId: z.string(),
  sourceContentHash: z.string().nullish(),
  sourceVersion: z.number().int().nullish(),
  entryId: z.string(),
  entryVersion: z.number().int(),
  title: z.string(),
  content: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  status: z.string().default("draft"),
  eligibility: z.string().default("ineligible"),
  staleReason: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiKnowledgeUnitType = z.infer<typeof XiaofeiKnowledgeUnitSchema>;
