import type { Context } from 'aws-lambda'
import { ALARM } from './constants'
import { CloudWatchLogs } from './CloudWatchLogs'
import { Slack, SlackMessage } from './Slack'
import { SnsEvent } from './Sns'
import type { SnsEvent as SnsEventType } from './types'

export async function handler(event: SnsEventType, context: Context): Promise<void> {
  console.info('Received Event:', JSON.stringify(event))

  let slack: Slack | undefined
  try {
    slack = new Slack(process.env.SLACK_WEBHOOK_URL)

    const sns = new SnsEvent(event)
    const cwl = new CloudWatchLogs()

    for (const message of sns.messages) {
      const payload = new SlackMessage(message)

      if (message.message.NewStateValue === ALARM) {
        const events = await cwl.getLogEvents(message)
        payload.attach(...events)
      }

      await slack.send(payload)
    }

    console.info('Succeeded.')
    context.succeed(undefined)
  } catch (error) {
    console.error(error)

    console.info('Failed.')
    context.fail(error as Error)
  } finally {
    if (slack) {
      console.info(
        'Slack Send Result:',
        `Total=${slack.total},`,
        `Sent=${slack.sent},`,
        `Unexpected=${slack.unexpected},`,
        `Failed=${slack.failed}`
      )
    }
  }
}
