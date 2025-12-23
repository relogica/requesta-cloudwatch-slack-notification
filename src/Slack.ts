import { deepStrictEqual } from 'assert'
import { IncomingWebhook } from '@slack/webhook'
import type { SnsMessage } from './Sns'
import type { FilteredLogEvent, SlackAttachment, SlackMessagePayload } from './types'
import {
  OK_SLACK_RESPONSE,
  RED,
  MAX_SLACK_ATTACHMENTS,
  TAIL,
  STATE_COLOR,
} from './constants'

export class SlackWebhookUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class Slack {
  private webhook: IncomingWebhook
  sent = 0
  unexpected = 0
  failed = 0
  total = 0

  constructor(url: string | undefined) {
    if (!url) {
      throw new SlackWebhookUrlError('Webhook URL is required.')
    }

    try {
      new URL(url)
    } catch {
      throw new SlackWebhookUrlError('Malformed URL.')
    }

    this.webhook = new IncomingWebhook(url)
  }

  async send(message: SlackMessage): Promise<void> {
    try {
      message.trim()
      console.info('Slack Message:', JSON.stringify(message.message))

      const result = await this.webhook.send(message.message)
      console.info('Slack Send Response:', JSON.stringify(result))

      try {
        deepStrictEqual(result, OK_SLACK_RESPONSE)
        this.sent++
      } catch {
        console.warn(
          'Unexpected OK Slack Response:',
          `Expected=${JSON.stringify(OK_SLACK_RESPONSE)},`,
          `Actual=${JSON.stringify(result)}`
        )
        this.unexpected++
      }
    } catch (error) {
      const err = error as Error & { original?: { config?: unknown } }
      if (err.original && 'config' in err.original) {
        delete err.original.config
      }

      console.error('Slack Send Failed:', JSON.stringify(error))
      this.failed++
    } finally {
      this.total++
    }
  }
}

function sanitize(text: string, pattern = /[&<>]/g): string {
  return String(text).replace(pattern, (match) => {
    switch (match) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      default:
        console.warn('Ignored Control Character:', match)
        return match
    }
  })
}

export class SlackMessage {
  message: SlackMessagePayload

  constructor(snsMessage: SnsMessage) {
    const msg = snsMessage.message
    this.message = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: sanitize(msg.AlarmName),
            emoji: false,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*State Change Time*\n${new Date(msg.StateChangeTime).toUTCString()}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New State Reason*\n${sanitize(msg.NewStateReason)}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Old State Value*\n${sanitize(msg.OldStateValue)}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '\n',
          },
        },
      ],
      attachments: [
        {
          title: 'New State Value',
          text: sanitize(msg.NewStateValue),
          color: STATE_COLOR.get(msg.NewStateValue) || RED,
        },
      ],
    }
  }

  attach(...events: FilteredLogEvent[]): void {
    const attachments: SlackAttachment[] = events.map((event) => ({
      title: event.timestamp ? new Date(event.timestamp).toUTCString() : '',
      text: `\`\`\`${sanitize(event.message || '')}\`\`\``,
      color: RED,
    }))

    this.message.attachments.push(...attachments)
  }

  trim(): void {
    const length = this.message.attachments.length
    if (length > MAX_SLACK_ATTACHMENTS) {
      const excluded = this.message.attachments.splice(
        MAX_SLACK_ATTACHMENTS,
        Number.POSITIVE_INFINITY,
        TAIL
      )

      console.warn(
        'Slack Message Attachments Trimmed:',
        `Included=${this.message.attachments.length},`,
        `Excluded=${excluded.length}`
      )
    }
  }
}

export { sanitize }
