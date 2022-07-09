import { ICapInfo } from './caps';

export interface ICampaign {
  campaignId: number,
  name: string
  offerId: number
  affiliateId: number
  affiliateType: string
  campaignStatus: string
  capsEnabled: boolean | null
  capSetup: boolean
  capInfo: ICapInfo
  payout: number
  payoutPercent: number | null
  affiliateManagerId: number
  targetRules?: object[]
}

export interface ICampaignsName {
  id: number,
  name: string
}
