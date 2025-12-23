import type { FilteredLogEvent } from '@aws-sdk/client-cloudwatch-logs'

export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA'

export interface CloudWatchAlarmMessage {
  AlarmName: string
  AlarmDescription?: string
  AWSAccountId: string
  NewStateValue: AlarmState
  NewStateReason: string
  StateChangeTime: string
  Region: string
  OldStateValue: AlarmState
  Trigger: {
    MetricName: string
    Namespace: string
    StatisticType: string
    Statistic: string
    Unit: string | null
    Dimensions: Array<{ name: string; value: string }>
    Period: number
    EvaluationPeriods: number
    ComparisonOperator: string
    Threshold: number
    TreatMissingData: string
    EvaluateLowSampleCountPercentile: string
  }
}

export interface SnsRecord {
  EventSource: string
  EventVersion: string
  EventSubscriptionArn: string
  Sns: {
    Type: string
    MessageId: string
    TopicArn: string
    Subject: string | null
    Message: string
    Timestamp: string
    SignatureVersion: string
    Signature: string
    SigningCertUrl: string
    UnsubscribeUrl: string
    MessageAttributes: Record<string, unknown>
  }
}

export interface SnsEvent {
  Records: SnsRecord[]
}

export interface SlackAttachment {
  title?: string
  text: string
  color: string
}

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
}

export interface SlackMessagePayload {
  blocks: SlackBlock[]
  attachments: SlackAttachment[]
}

export interface SlackResponse {
  text: string
}

export interface MetricFilter {
  filterName?: string
  filterPattern?: string
  logGroupName?: string
  metricTransformations?: Array<{
    metricName?: string
    metricNamespace?: string
    metricValue?: string
  }>
}

export { FilteredLogEvent }
