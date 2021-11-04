import {ICapInfo} from "./caps"

export interface IOffer {
  offerId: number
  name: string
  advertiserId: number
  advertiserName: string
  verticalId: number
  verticalName: string
  advertiserManagerId: number
  conversionType: string
  currencyId: number
  status: string
  payin: number
  payout: number
  isCpmOptionEnabled: boolean
  landingPageId: number
  landingPageUrl: string
  sflOfferGeoId: number
  geoRules: string
  geoOfferId: number
  customLpRules: string
  offerIdRedirectExitTraffic: number
  useStartEndDate: boolean
  startDate: Date
  endDate: Date
  type: string
  customPayOutCount: number
  capOfferId: number
  capSetup: boolean | undefined
  capsEnabled: boolean | undefined
  startEndDateSetup: boolean | undefined
  startEndDateSetting: object
  customPayOutPerGeo: string
  offersAggregatedIds?: object[]
  capInfo: ICapInfo
  landingPageUrlOrigin: string | undefined
  offerIdOrigin: number | undefined
  referredOfferId: number | undefined
  redirectType: string | undefined
  redirectReason: string | undefined
}

