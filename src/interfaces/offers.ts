import { ICapInfo } from './caps';

export interface IOffer {
  offerId: number
  name: string
  descriptions: string
  advertiserId: number
  advertiserName: string
  verticalId: number
  verticalName: string
  advertiserManagerId: number
  conversionType: string
  currencyId: number
  status: IOfferStatus
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
  countriesRestrictions?: string
  capOfferId: number
  capSetup: boolean | undefined
  capsEnabled: boolean | undefined
  startEndDateSetup: boolean | undefined
  startEndDateSetting: IStartEndDateSetting
  customPayOutPerGeo: string
  offersAggregatedIds?: object[]
  capInfo: ICapInfo
  exitOffersNested?: IOffer[]
  exitOfferDetected?: IOffer
  landingPageUrlOrigin: string | undefined
  redirectType: string | undefined
  redirectReason: string | undefined
}

export interface IStartEndDateSetting {
  startDate: Date,
  endDate: Date,
  dateRangePass: boolean,
}

export interface IOffersMargin {
  capsOverLimitSales?: boolean
  capsOverLimitClicks?: boolean
  dateRangeNotPass?: boolean
  countriesRestrictions?: string
  customLpCountriesRestrictions?: string
  aggregatedOfferId: number
  margin: number
}

export enum IOfferStatus {
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  PUBLIC = 'public',
  PRIVATE = 'private',
  APPLY_TO_RUN = 'apply_to_run',
  PENDING = 'pending',
}

export interface IOffersName {
  id: number,
  name: string
}
export const EXIT_OFFERS_NESTED_LIMIT = 5;
