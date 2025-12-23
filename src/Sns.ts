import { ALARM, ALARM_NEW_STATE_REASON_PATTERN } from './constants'
import type { CloudWatchAlarmMessage, SnsEvent as SnsEventType, SnsRecord } from './types'

export class SnsMessageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class SnsMessage {
  message: CloudWatchAlarmMessage
  datapoints?: number
  datapoint?: Date

  constructor(message: CloudWatchAlarmMessage) {
    this.message = message

    if (message.NewStateValue === ALARM) {
      const match = message.NewStateReason.match(ALARM_NEW_STATE_REASON_PATTERN)
      if (match?.groups) {
        const { datapoints, day, month, year, hour, minute, second } = match.groups
        this.datapoints = parseFloat(datapoints)
        this.datapoint = new Date(
          `${month} ${day} ${year} ${hour}:${minute}:${second} GMT`
        )
      }
    }
  }
}

export class SnsEvent {
  messages: SnsMessage[]

  constructor(event: SnsEventType) {
    this.messages = event.Records
      .filter((record: SnsRecord) => record.Sns && record.Sns.Message)
      .map((record: SnsRecord) => new SnsMessage(JSON.parse(record.Sns.Message)))

    if (!this.messages.length) {
      throw new SnsMessageError('No SNS messages from records.')
    }
  }
}
