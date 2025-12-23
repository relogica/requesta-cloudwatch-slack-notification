import type { AlarmState, SlackAttachment, SlackResponse } from './types'

export const OK: AlarmState = 'OK'
export const ALARM: AlarmState = 'ALARM'
export const INSUFFICIENT_DATA: AlarmState = 'INSUFFICIENT_DATA'

export const GREEN = '#36A64F'
export const ORANGE = '#FFA500'
export const RED = '#FF0000'
export const YELLOW = '#FFFF00'

export const MAX_SLACK_ATTACHMENTS = 25

export const TAIL: SlackAttachment = {
  text: 'より詳細なエラー情報はCloudWatchを参照してください',
  color: YELLOW,
}

export const ALARM_NEW_STATE_REASON_PATTERN = new RegExp(
  /\[(?<datapoints>.*?)\s\((?<day>\d{2})\/(?<month>\d{2})\/(?<year>\d{2})\s(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})\)\]/
)

export const OK_SLACK_RESPONSE: SlackResponse = { text: 'ok' }

export const STATE_COLOR = new Map<AlarmState, string>([
  [OK, GREEN],
  [ALARM, RED],
  [INSUFFICIENT_DATA, ORANGE],
])
