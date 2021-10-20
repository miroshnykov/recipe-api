export interface ICampaign {
  campaignId: number,
  name: string
  offerId: number
  affiliateId: number
  payout: number
  payoutPercent: number | null
  affiliateManagerId: number
  targetRules?: object[]
}
