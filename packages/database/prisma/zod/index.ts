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

// File: XiaofeiOrganizationConfigScalarFieldEnum.schema.ts

export const XiaofeiOrganizationConfigScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'externalMerchantId', 'xiaofeiEnabled', 'emailDeliveryMode', 'emailCallbackUrl', 'createdAt', 'updatedAt'])

export type XiaofeiOrganizationConfigScalarFieldEnum = z.infer<typeof XiaofeiOrganizationConfigScalarFieldEnumSchema>;

// File: XiaofeiCustomerScalarFieldEnum.schema.ts

export const XiaofeiCustomerScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'externalCustomerId', 'name', 'email', 'whatsappNumber', 'status', 'lastSeenAt', 'createdAt', 'updatedAt'])

export type XiaofeiCustomerScalarFieldEnum = z.infer<typeof XiaofeiCustomerScalarFieldEnumSchema>;

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

export const XiaofeiConversationScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'externalId', 'customerId', 'channel', 'customerName', 'status', 'assignedUserId', 'assignedUserName', 'state', 'messages', 'traceEvents', 'lastCustomerSeenAt', 'lastMessageAt', 'createdAt', 'updatedAt'])

export type XiaofeiConversationScalarFieldEnum = z.infer<typeof XiaofeiConversationScalarFieldEnumSchema>;

// File: XiaofeiChannelBindingScalarFieldEnum.schema.ts

export const XiaofeiChannelBindingScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'workspaceId', 'companyId', 'channel', 'channelAccountId', 'address', 'status', 'createdAt', 'updatedAt'])

export type XiaofeiChannelBindingScalarFieldEnum = z.infer<typeof XiaofeiChannelBindingScalarFieldEnumSchema>;

// File: XiaofeiInboundEventScalarFieldEnum.schema.ts

export const XiaofeiInboundEventScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'source', 'eventId', 'schemaVersion', 'transportKind', 'topic', 'partition', 'offset', 'messageKey', 'eventType', 'occurredAt', 'payload', 'payloadHash', 'safeHeaders', 'status', 'deliveryCount', 'firstReceivedAt', 'lastReceivedAt', 'processedAt', 'lastError', 'createdAt', 'updatedAt'])

export type XiaofeiInboundEventScalarFieldEnum = z.infer<typeof XiaofeiInboundEventScalarFieldEnumSchema>;

// File: XiaofeiConversationMessageScalarFieldEnum.schema.ts

export const XiaofeiConversationMessageScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'conversationId', 'inboundEventId', 'eventId', 'sourceMessageId', 'providerMessageId', 'replyToSourceMessageId', 'direction', 'senderType', 'fromAddress', 'fromName', 'toRecipients', 'subject', 'contentType', 'contentValue', 'attachments', 'labels', 'sourceSendType', 'occurredAt', 'ingestedAt', 'createdAt'])

export type XiaofeiConversationMessageScalarFieldEnum = z.infer<typeof XiaofeiConversationMessageScalarFieldEnumSchema>;

// File: XiaofeiProcessingJobScalarFieldEnum.schema.ts

export const XiaofeiProcessingJobScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'inboundEventId', 'conversationId', 'conversationMessageId', 'kind', 'status', 'attempts', 'ownerEpoch', 'nextRunAt', 'lastError', 'createdAt', 'updatedAt'])

export type XiaofeiProcessingJobScalarFieldEnum = z.infer<typeof XiaofeiProcessingJobScalarFieldEnumSchema>;

// File: XiaofeiOutboundDeliveryScalarFieldEnum.schema.ts

export const XiaofeiOutboundDeliveryScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'conversationId', 'processingJobId', 'eventType', 'senderType', 'destinationMode', 'destinationUrl', 'payload', 'status', 'attempts', 'responseStatus', 'lastError', 'firstAttemptAt', 'deliveredAt', 'createdAt', 'updatedAt'])

export type XiaofeiOutboundDeliveryScalarFieldEnum = z.infer<typeof XiaofeiOutboundDeliveryScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeDocumentScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeDocumentScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceType', 'originalFileName', 'mimeType', 'fileType', 'sourceUrl', 'fileSizeBytes', 'provider', 'parserVersion', 'category', 'bodyText', 'contentHash', 'sourceVersion', 'fetchedAt', 'parseStatus', 'parseError', 'status', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeDocumentScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeDocumentScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeEntryScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeEntryScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceId', 'sourceContentHash', 'sourceVersion', 'question', 'answer', 'similarQueries', 'category', 'tags', 'status', 'entryVersion', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeEntryScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeEntryScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeUnitScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeUnitScalarFieldEnumSchema = z.enum(['id', 'workspaceId', 'sourceId', 'sourceContentHash', 'sourceVersion', 'entryId', 'entryVersion', 'title', 'content', 'status', 'eligibility', 'staleReason', 'createdAt', 'updatedAt'])

export type XiaofeiKnowledgeUnitScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeUnitScalarFieldEnumSchema>;

// File: XiaofeiKnowledgeUnitRevisionScalarFieldEnum.schema.ts

export const XiaofeiKnowledgeUnitRevisionScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'scopeKey', 'logicalKnowledgeUnitId', 'knowledgeUnitId', 'origin', 'revision', 'content', 'contentHash', 'createdAt'])

export type XiaofeiKnowledgeUnitRevisionScalarFieldEnum = z.infer<typeof XiaofeiKnowledgeUnitRevisionScalarFieldEnumSchema>;

// File: XiaofeiCapabilityVersionScalarFieldEnum.schema.ts

export const XiaofeiCapabilityVersionScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'capabilityKey', 'status', 'manifestHash', 'createdAt'])

export type XiaofeiCapabilityVersionScalarFieldEnum = z.infer<typeof XiaofeiCapabilityVersionScalarFieldEnumSchema>;

// File: XiaofeiCapabilityBindingScalarFieldEnum.schema.ts

export const XiaofeiCapabilityBindingScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'capabilityKey', 'activeCapabilityVersionId', 'testCapabilityVersionId', 'createdAt', 'updatedAt'])

export type XiaofeiCapabilityBindingScalarFieldEnum = z.infer<typeof XiaofeiCapabilityBindingScalarFieldEnumSchema>;

// File: XiaofeiCapabilityVersionKnowledgeUnitScalarFieldEnum.schema.ts

export const XiaofeiCapabilityVersionKnowledgeUnitScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'capabilityVersionId', 'knowledgeUnitRevisionScopeKey', 'knowledgeUnitRevisionId', 'role', 'priority', 'createdAt'])

export type XiaofeiCapabilityVersionKnowledgeUnitScalarFieldEnum = z.infer<typeof XiaofeiCapabilityVersionKnowledgeUnitScalarFieldEnumSchema>;

// File: XiaofeiResponseInterventionScalarFieldEnum.schema.ts

export const XiaofeiResponseInterventionScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'correction', 'beforeResponse', 'afterResponse', 'beforeCapabilityVersionId', 'resultCapabilityVersionId', 'beforeKnowledgeRevisionScopeKey', 'beforeKnowledgeRevisionId', 'resultKnowledgeRevisionScopeKey', 'resultKnowledgeRevisionId', 'sourceTestTurnId', 'createdAt'])

export type XiaofeiResponseInterventionScalarFieldEnum = z.infer<typeof XiaofeiResponseInterventionScalarFieldEnumSchema>;

// File: XiaofeiTestTurnScalarFieldEnum.schema.ts

export const XiaofeiTestTurnScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'testSessionId', 'question', 'answer', 'capabilityVersionId', 'conversationState', 'runtimeMetadata', 'evidenceRevisionScopeKey', 'evidenceRevisionId', 'sourceTestTurnId', 'rerunOfTestTurnId', 'interventionId', 'requestedAt', 'completedAt', 'createdAt'])

export type XiaofeiTestTurnScalarFieldEnum = z.infer<typeof XiaofeiTestTurnScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: NullableJsonNullValueInput.schema.ts

export const NullableJsonNullValueInputSchema = z.enum(['DbNull', 'JsonNull'])

export type NullableJsonNullValueInput = z.infer<typeof NullableJsonNullValueInputSchema>;

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


// File: XiaofeiOrganizationConfig.schema.ts

export const XiaofeiOrganizationConfigSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  externalMerchantId: z.string().nullish(),
  xiaofeiEnabled: z.boolean(),
  emailDeliveryMode: z.string().default("mock"),
  emailCallbackUrl: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiOrganizationConfigType = z.infer<typeof XiaofeiOrganizationConfigSchema>;


// File: XiaofeiCustomer.schema.ts

export const XiaofeiCustomerSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  externalCustomerId: z.string(),
  name: z.string().nullish(),
  email: z.string().nullish(),
  whatsappNumber: z.string().nullish(),
  status: z.string().default("active"),
  lastSeenAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiCustomerType = z.infer<typeof XiaofeiCustomerSchema>;


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
  customerId: z.string().nullish(),
  channel: z.string().default("public_support"),
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


// File: XiaofeiChannelBinding.schema.ts

export const XiaofeiChannelBindingSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  workspaceId: z.string(),
  companyId: z.string(),
  channel: z.string(),
  channelAccountId: z.string(),
  address: z.string(),
  status: z.string().default("active"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiChannelBindingType = z.infer<typeof XiaofeiChannelBindingSchema>;


// File: XiaofeiInboundEvent.schema.ts

export const XiaofeiInboundEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  source: z.string(),
  eventId: z.string(),
  schemaVersion: z.string(),
  transportKind: z.string(),
  topic: z.string().nullish(),
  partition: z.number().int().nullish(),
  offset: z.string().nullish(),
  messageKey: z.string().nullish(),
  eventType: z.string(),
  occurredAt: z.date(),
  payload: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  payloadHash: z.string(),
  safeHeaders: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("{}"),
  status: z.string().default("accepted"),
  deliveryCount: z.number().int().default(1),
  firstReceivedAt: z.date(),
  lastReceivedAt: z.date(),
  processedAt: z.date().nullish(),
  lastError: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiInboundEventType = z.infer<typeof XiaofeiInboundEventSchema>;


// File: XiaofeiConversationMessage.schema.ts

export const XiaofeiConversationMessageSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  conversationId: z.string(),
  inboundEventId: z.string(),
  eventId: z.string(),
  sourceMessageId: z.string(),
  providerMessageId: z.string().nullish(),
  replyToSourceMessageId: z.string().nullish(),
  direction: z.string(),
  senderType: z.string(),
  fromAddress: z.string(),
  fromName: z.string().nullish(),
  toRecipients: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  subject: z.string().nullish(),
  contentType: z.string(),
  contentValue: z.string(),
  attachments: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  labels: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  sourceSendType: z.number().int().nullish(),
  occurredAt: z.date(),
  ingestedAt: z.date(),
  createdAt: z.date(),
});

export type XiaofeiConversationMessageType = z.infer<typeof XiaofeiConversationMessageSchema>;


// File: XiaofeiProcessingJob.schema.ts

export const XiaofeiProcessingJobSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  inboundEventId: z.string(),
  conversationId: z.string(),
  conversationMessageId: z.string(),
  kind: z.string().default("mirrored"),
  status: z.string().default("mirrored"),
  attempts: z.number().int(),
  ownerEpoch: z.number().int().nullish(),
  nextRunAt: z.date().nullish(),
  lastError: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiProcessingJobType = z.infer<typeof XiaofeiProcessingJobSchema>;


// File: XiaofeiOutboundDelivery.schema.ts

export const XiaofeiOutboundDeliverySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  conversationId: z.string(),
  processingJobId: z.string().nullish(),
  eventType: z.string(),
  senderType: z.string(),
  destinationMode: z.string(),
  destinationUrl: z.string().nullish(),
  payload: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  status: z.string().default("pending"),
  attempts: z.number().int(),
  responseStatus: z.number().int().nullish(),
  lastError: z.string().nullish(),
  firstAttemptAt: z.date().nullish(),
  deliveredAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiOutboundDeliveryType = z.infer<typeof XiaofeiOutboundDeliverySchema>;


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


// File: XiaofeiKnowledgeUnitRevision.schema.ts

export const XiaofeiKnowledgeUnitRevisionSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  scopeKey: z.string(),
  logicalKnowledgeUnitId: z.string(),
  knowledgeUnitId: z.string().nullish(),
  origin: z.string(),
  revision: z.number().int(),
  content: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  contentHash: z.string(),
  createdAt: z.date(),
});

export type XiaofeiKnowledgeUnitRevisionType = z.infer<typeof XiaofeiKnowledgeUnitRevisionSchema>;


// File: XiaofeiCapabilityVersion.schema.ts

export const XiaofeiCapabilityVersionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  capabilityKey: z.string(),
  status: z.string().default("test"),
  manifestHash: z.string(),
  createdAt: z.date(),
});

export type XiaofeiCapabilityVersionType = z.infer<typeof XiaofeiCapabilityVersionSchema>;


// File: XiaofeiCapabilityBinding.schema.ts

export const XiaofeiCapabilityBindingSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  capabilityKey: z.string(),
  activeCapabilityVersionId: z.string().nullish(),
  testCapabilityVersionId: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type XiaofeiCapabilityBindingType = z.infer<typeof XiaofeiCapabilityBindingSchema>;


// File: XiaofeiCapabilityVersionKnowledgeUnit.schema.ts

export const XiaofeiCapabilityVersionKnowledgeUnitSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  capabilityVersionId: z.string(),
  knowledgeUnitRevisionScopeKey: z.string(),
  knowledgeUnitRevisionId: z.string(),
  role: z.string().default("primary"),
  priority: z.number().int(),
  createdAt: z.date(),
});

export type XiaofeiCapabilityVersionKnowledgeUnitType = z.infer<typeof XiaofeiCapabilityVersionKnowledgeUnitSchema>;


// File: XiaofeiResponseIntervention.schema.ts

export const XiaofeiResponseInterventionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  correction: z.string(),
  beforeResponse: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  afterResponse: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  beforeCapabilityVersionId: z.string(),
  resultCapabilityVersionId: z.string(),
  beforeKnowledgeRevisionScopeKey: z.string().nullish(),
  beforeKnowledgeRevisionId: z.string().nullish(),
  resultKnowledgeRevisionScopeKey: z.string(),
  resultKnowledgeRevisionId: z.string(),
  sourceTestTurnId: z.string().nullish(),
  createdAt: z.date(),
});

export type XiaofeiResponseInterventionType = z.infer<typeof XiaofeiResponseInterventionSchema>;


// File: XiaofeiTestTurn.schema.ts

export const XiaofeiTestTurnSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  testSessionId: z.string(),
  question: z.string(),
  answer: z.string(),
  capabilityVersionId: z.string(),
  conversationState: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  runtimeMetadata: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  evidenceRevisionScopeKey: z.string().nullish(),
  evidenceRevisionId: z.string().nullish(),
  sourceTestTurnId: z.string().nullish(),
  rerunOfTestTurnId: z.string().nullish(),
  interventionId: z.string().nullish(),
  requestedAt: z.date(),
  completedAt: z.date(),
  createdAt: z.date(),
});

export type XiaofeiTestTurnType = z.infer<typeof XiaofeiTestTurnSchema>;

