export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Conversation {
  id: string;
  channel: string;
  externalConversationId?: string;
  customerId?: string;
  status: string;
  priority?: number;
  assignedTeam?: string;
  assignedAgentId?: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  sender: { externalId: string; displayName?: string };
  content: { type: string; text?: string; mediaUrl?: string; caption?: string };
  createdAt: string;
}

export interface AnalyticsSummary {
  business: {
    messagesInbound: number;
    messagesOutbound: number;
    conversationsCreated: number;
    conversationsResolved: number;
    customersCreated: number;
    aiAnalyses: number;
    aiContainmentRate: number;
    routingDecisions: number;
    handoffRate: number;
    deliverySuccessRate: number;
  };
  technical: {
    eventsByType: Record<string, number>;
    deliveriesFailed: number;
    aiLowConfidence: number;
    routingHandoffs: number;
  };
}

export interface IncidentDefinition {
  code: string;
  type: string;
  title: string;
  theme: string;
  symptoms: string[];
  diagnosis: string[];
  runbook: string;
  usesFaultFlags: boolean;
}

export interface ActiveIncident {
  incidentId: string;
  code: string;
  type: string;
  title: string;
  startedAt: string;
  durationSeconds?: number;
  params: Record<string, unknown>;
  symptoms: string[];
  diagnosis: string[];
  runbook: string;
}

export interface IncidentsResponse {
  catalog: IncidentDefinition[];
  active: ActiveIncident[];
}

export interface RoutingDecision {
  id: string;
  conversationId: string;
  assignedTeam: string;
  priority: number;
  reason: string[];
  handoffToHuman: boolean;
  handoffReason?: string;
  createdAt: string;
}

export interface AnalyzeResult {
  status: string;
  eventId?: string;
  confidence?: number;
  usedFallback?: boolean;
  intent?: string;
  sentiment?: string;
  entities?: Record<string, string>;
  summary?: string;
  correlationId?: string;
}

export interface DlqResponse {
  data: unknown[];
  size: number;
}

export interface CircuitResponse {
  channel: string;
  state: string;
}

export interface Customer {
  id: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  identities: Array<{
    channel: string;
    externalId: string;
    displayName?: string;
    createdAt: string;
  }>;
}
