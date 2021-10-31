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
  exitTrafficSales?: boolean | null
  currentDate: string | null
  capsType?: ICapsType | null
  dateStart?: string | null
  dateEnd?: string | null
  dateRangePass: boolean | null
  dateRangeNotPassDescriptions: string | null
  campaignCapsOfferIdRedirect?: number | null
}

export interface ICapResult {
  period: string
  limit: number
  currentAmount: number
}

export enum ICapsType {
  CAPS_DATA_RANGE_NOT_PASS = 'dataRangeNotPass',
  CAPS_OVER_LIMIT_ClICKS = 'overLimitClicks',
  CAPS_UNDER_LIMIT_ClICKS = 'underLimitClicks',
  CAPS_OVER_LIMIT_SALES = 'overLimitSales',
  CAPS_UNDER_LIMIT_SALES = 'underLimitSales',
  CAPS_UNDER_LIMIT = 'underLimit',
  CAPS_CAMPAIGN_DATA_RANGE_NOT_PASS = 'campaignCapsDataRangeNotPass',
  CAPS_CAMPAIGN_UNDER_LIMIT = 'campaignUnderLimit',
  CAPS_CAMPAIGN_OVER_LIMIT_SALES = 'campaignOverLimitSales',
  CAPS_CAMPAIGN_UNDER_LIMIT_ClICKS = 'campaignUnderLimitClicks',
}

