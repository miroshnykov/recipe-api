export interface ISqsMessage {
  comments: string,
  type: ISqsMessageType
  id: number
  action: ISqsMessageAction
  timestamp: number
  body: string
  project?: string
}

export enum ISqsMessageType {
  OFFER = 'offer',
  CAMPAIGN = 'campaign'
}

export enum ISqsMessageAction {
  UPDATE_OR_CREATE = 'updateOrCreate',
  DELETE = 'delete'
}
