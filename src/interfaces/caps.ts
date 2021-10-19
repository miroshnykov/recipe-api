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
  capClicksRedirect: boolean | null
  capSalesRedirect: boolean | null
  capsSalesUnderLimit: boolean | null
  capsSalesOverLimit: boolean | null
  capsClicksUnderLimit: boolean | null
  capsClicksOverLimit: boolean | null
  exitTrafficClicks: boolean | null
  exitTrafficSales: boolean | null
  currentDate: string | null
  dateStart: string | null
  dateEnd: string | null
  dateRangePass: boolean | null
  dateRangeNotPassDescriptions: string | null
}