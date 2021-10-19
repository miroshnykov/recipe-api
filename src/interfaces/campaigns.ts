export interface ICampaign {
  campaignId: number,
  name: string
  offerId: number
  affiliateId: number
  payout: number
  payoutPercent: number
  affiliateManagerId: number
  targetRules?:object[]
}
