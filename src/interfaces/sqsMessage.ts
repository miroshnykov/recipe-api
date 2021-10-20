export interface ISqsMessage {
  comments: string,
  type: string
  id: number
  action: string
  timestamp: number
  body: string
}
