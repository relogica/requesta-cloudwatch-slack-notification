import {
  CloudWatchLogsClient,
  paginateDescribeMetricFilters,
  paginateFilterLogEvents,
} from '@aws-sdk/client-cloudwatch-logs'
import type { SnsMessage } from './Sns'
import type { FilteredLogEvent, MetricFilter } from './types'

export class CloudWatchLogs {
  private client: CloudWatchLogsClient

  constructor() {
    this.client = new CloudWatchLogsClient({})
  }

  async describeMetricFilters(snsMessage: SnsMessage): Promise<MetricFilter[]> {
    const metricFilters: MetricFilter[] = []
    const paginator = paginateDescribeMetricFilters(
      { client: this.client },
      {
        metricName: snsMessage.message.Trigger.MetricName,
        metricNamespace: snsMessage.message.Trigger.Namespace,
      }
    )

    for await (const page of paginator) {
      if (page.metricFilters) {
        metricFilters.push(...page.metricFilters)
      }
    }

    console.info('Metric Filters:', JSON.stringify(metricFilters))
    return metricFilters
  }

  async filterLogEvents(
    snsMessage: SnsMessage,
    metricFilter: MetricFilter
  ): Promise<FilteredLogEvent[]> {
    if (!snsMessage.datapoint || !metricFilter.logGroupName) {
      return []
    }

    const startTime = snsMessage.datapoint.getTime()
    const endTime =
      startTime +
      snsMessage.message.Trigger.Period *
        snsMessage.message.Trigger.EvaluationPeriods *
        1000

    const events: FilteredLogEvent[] = []
    const paginator = paginateFilterLogEvents(
      { client: this.client },
      {
        startTime,
        endTime,
        logGroupName: metricFilter.logGroupName,
        filterPattern: metricFilter.filterPattern,
      }
    )

    for await (const page of paginator) {
      if (page.events) {
        events.push(...page.events)
      }
    }

    if (snsMessage.datapoints !== undefined && events.length !== snsMessage.datapoints) {
      console.warn(
        'Log Events Count:',
        `Expected=${snsMessage.datapoints},`,
        `Actual=${events.length}`
      )
    }

    console.info('Log Events:', JSON.stringify(events))
    return events
  }

  async getLogEvents(snsMessage: SnsMessage): Promise<FilteredLogEvent[]> {
    const result: FilteredLogEvent[] = []

    const metrics = await this.describeMetricFilters(snsMessage)
    if (metrics.length === 0) {
      console.warn('No Metric Filters:', JSON.stringify(snsMessage.message))
      return result
    }

    for (const metric of metrics) {
      const logs = await this.filterLogEvents(snsMessage, metric)
      result.push(...logs)
    }

    return result
  }
}
