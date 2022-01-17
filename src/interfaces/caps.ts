interface ICapDataDetail {
  current: number,
  limit: number
}

interface ICapData {
  day: ICapDataDetail,
  week: ICapDataDetail,
  month: ICapDataDetail
}

export interface ICapInfo {
  sales: ICapData
  clicks: ICapData
  dateRangeSetUp: boolean | null
  capClicksRedirect?: boolean | null
  capSalesRedirect?: boolean | null
  capsSalesUnderLimit: boolean | null
  capsSalesUnderLimitDetails: string | null
  capsSalesOverLimit: boolean | null
  capsSalesOverLimitDetails: string | null
  capsClicksUnderLimit: boolean | null
  capsClicksUnderLimitDetails: string | null
  capsClicksOverLimit: boolean | null
  capsClicksOverLimitDetails: string | null
  exitTrafficClicks?: boolean | null
  isExitTraffic?: boolean | null
  exitTrafficSales?: boolean | null
  currentDate: Date | null
  capsType?: ICapsType | null
  dateStart?: Date | null
  dateEnd?: Date | null
  dateRangePass: boolean | null
  dateRangeNotPassDescriptions: string | null
  offerCapsOfferIdRedirect?: number | null
  campaignCapsOfferIdRedirect?: number | null
}

export interface ICaps {
  clicksDaySetUpLimit: number
  clicksWeekSetUpLimit: number
  clicksMonthSetupLimit: number
  clicksDayCurrent: number
  clicksWeekCurrent: number
  clicksMonthCurrent: number
  clicksRedirectOfferId: number
  clicksRedirectOfferUseDefault?: number
  salesDaySetUpLimit: number
  salesWeekSetUpLimit: number
  salesMonthSetupLimit: number
  salesDayCurrent: number
  salesWeekCurrent: number
  salesMonthCurrent: number
  salesRedirectOfferId: number
  salesRedirectOfferUseDefault?: number
  capsStartDate: Date
  capsEndDate: Date
  useStartEndDate?: Date
}

export interface ICapResult {
  period: string
  limit: number
  currentAmount: number
}

export enum ICapsType {
  CAPS_OFFER_DATA_RANGE_NOT_PASS = 'offerDataRangeNotPass',
  CAPS_OFFER_UNDER_LIMIT = 'offerUnderLimit',
  CAPS_OFFER_OVER_LIMIT_ClICKS = 'offerOverLimitClicks',
  CAPS_OFFER_OVER_LIMIT_SALES = 'offerOverLimitSales',
  CAPS_CAMPAIGN_DATA_RANGE_NOT_PASS = 'campaignCapsDataRangeNotPass',
  CAPS_CAMPAIGN_UNDER_LIMIT = 'campaignUnderLimit',
  CAPS_CAMPAIGN_UNDER_LIMIT_ClICKS = 'campaignUnderLimitClicks',
  CAPS_CAMPAIGN_UNDER_LIMIT_SALES = 'campaignUnderLimitSales',
  CAPS_CAMPAIGN_OVER_LIMIT_SALES = 'campaignOverLimitSales',
}
