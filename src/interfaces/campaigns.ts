import {ICapInfo} from "./caps";

export interface ICampaign {
  campaignId: number,
  name: string
  offerId: number
  affiliateId: number
  capsEnabled: boolean | null
  capSetup: boolean
  capInfo: ICapInfo
  payout: number
  payoutPercent: number | null
  affiliateManagerId: number
  targetRules?: object[]
}
