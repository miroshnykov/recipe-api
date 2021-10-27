import consola from "consola";
import {getAggregatedOffers, getCaps, getCustomPayoutPerGeo, getOffer} from "./offersModel";
import {influxdb} from "../metrics";

import {IOffer} from "../interfaces/offers"
import {ICapInfo} from "../interfaces/caps"

export const reCalculateOffer = async (offer: IOffer) => {
  try {
    if (offer.type === 'aggregated') {
      offer.offersAggregatedIds = await getAggregatedOffers(offer.offerId) || []
      return offer
    }

    if (offer.capOfferId) {
      let offerCaps = await reCalculateOfferCaps(offer.offerId)
      if (offerCaps?.capSetup && offerCaps?.capInfo) {
        offer.capInfo = offerCaps.capInfo
        offer.capSetup = offerCaps.capSetup
        offer.landingPageUrlOrigin = offerCaps.landingPageUrl
        offer.offerIdOrigin = offerCaps.offerId
        offer.referredOfferId = offerCaps.referredOfferId
        offer.redirectType = offerCaps.redirectType
        offer.redirectReason = offerCaps.redirectReason
      }
    }

    if (offer.useStartEndDate) {
      offer.startEndDateSetup = true
      const currentDate = new Date()
      offer.startEndDateSetting = {
        startDate: offer.startDate,
        endDate: offer.endDate,
        dateRangePass: currentDate > offer.startDate && currentDate < offer.endDate
      }
    }

    if (offer.customPayOutCount > 0) {
      let customPayOutData = await getCustomPayoutPerGeo(offer.offerId)
      offer.customPayOutPerGeo = JSON.stringify(customPayOutData)
    }
    offer.payin = Number(offer.payin)
    offer.payout = Number(offer.payout)
    return offer
  } catch (e) {
    consola.error('reCalculateOfferError:', e)
    influxdb(500, `re_calculate_offer_error`)
    return []
  }
}

export const reCalculateOfferCaps = async (offerId: number) => {
  try {
    let offer: IOffer = await getOffer(offerId)
    let offerCaps: any = await getCaps(offerId)
    const {
      clicksDaySetUpLimit,
      clicksWeekSetUpLimit,
      clicksMonthSetupLimit,
      clicksDayCurrent,
      clicksWeekCurrent,
      clicksMonthCurrent,
      capRedirectId,
      clicksRedirectOfferUseDefault,
      salesDaySetUpLimit,
      salesWeekSetUpLimit,
      salesMonthSetupLimit,
      salesDayCurrent,
      salesWeekCurrent,
      salesMonthCurrent,
      capSalesRedirectOfferId,
      salesRedirectOfferUseDefault,
      capsStartDate,
      capsEndDate,
      useStartEndDate
    } = offerCaps

    if (!clicksDaySetUpLimit
      && !clicksWeekSetUpLimit
      && !clicksMonthSetupLimit
      && !salesDaySetUpLimit
      && !salesWeekSetUpLimit
      && !salesMonthSetupLimit
    ) {
      return offer
    }

    offer.capSetup = true
    let capInfo: ICapInfo = {
      sales: {
        day: {
          current: 0,
          limit: 0
        },
        week: {
          current: 0,
          limit: 0
        },
        month: {
          current: 0,
          limit: 0,
        }
      },
      clicks: {
        day: {
          current: 0,
          limit: 0
        },
        week: {
          current: 0,
          limit: 0
        },
        month: {
          current: 0,
          limit: 0,
        }
      },
      dateRangeSetUp: null,
      capClicksRedirect: null,
      capSalesRedirect: null,
      dateStart: null,
      dateEnd: null,
      currentDate: null,
      dateRangePass: null,
      dateRangeNotPassDescriptions: null,
      capsSalesUnderLimit: null,
      capsSalesOverLimit: null,
      capsClicksUnderLimit: null,
      capsClicksOverLimit: null,
      exitTrafficSales: null,
      exitTrafficClicks: null
    }

    if (useStartEndDate && capsStartDate && capsEndDate) {
      capInfo.dateRangeSetUp = true
      capInfo.dateStart = capsStartDate
      capInfo.dateEnd = capsEndDate
      const currentDate = new Date()
      capInfo.currentDate = capsEndDate
      capInfo.dateRangePass = currentDate > capsStartDate && currentDate < capsEndDate

      if (!capInfo.dateRangePass) {
        capInfo.dateRangeNotPassDescriptions = `capsStartDate:${capsStartDate} capsEndDate:${capsEndDate}`
        offer.capInfo = capInfo
        return offer
      }
    }

    capInfo.sales.day.current = salesDayCurrent
    capInfo.sales.day.limit = salesDaySetUpLimit

    capInfo.sales.week.current = salesWeekCurrent
    capInfo.sales.week.limit = salesWeekSetUpLimit

    capInfo.sales.month.current = salesMonthCurrent
    capInfo.sales.month.limit = salesMonthSetupLimit

    if (salesDaySetUpLimit || salesWeekSetUpLimit || salesMonthSetupLimit) {

      capInfo.capsSalesUnderLimit = salesDayCurrent < salesDaySetUpLimit
        || salesWeekCurrent < salesWeekSetUpLimit
        || salesMonthCurrent < salesMonthSetupLimit
      capInfo.capsSalesOverLimit = !capInfo.capsSalesUnderLimit
    }

    capInfo.clicks.day.current = clicksDayCurrent
    capInfo.clicks.day.limit = clicksDaySetUpLimit

    capInfo.clicks.week.current = clicksWeekCurrent
    capInfo.clicks.week.limit = clicksWeekSetUpLimit

    capInfo.clicks.month.current = clicksMonthCurrent
    capInfo.clicks.month.limit = clicksMonthSetupLimit


    if (clicksDaySetUpLimit || clicksWeekSetUpLimit || clicksMonthSetupLimit) {
      capInfo.capsClicksUnderLimit = clicksDayCurrent < clicksDaySetUpLimit
        || clicksWeekCurrent < clicksWeekSetUpLimit
        || clicksMonthCurrent < clicksMonthSetupLimit
      capInfo.capsClicksOverLimit = !capInfo.capsClicksUnderLimit
    }


    if (capInfo.capsClicksOverLimit) {
      if (clicksRedirectOfferUseDefault) {
        capInfo.exitTrafficClicks = true
        await offerReferred(offer, offer.offerIdRedirectExitTraffic, 'capsClicksOverLimit', 'capsClicksOverLimitExitTraffic')

      } else {
        capInfo.capClicksRedirect = true
        await offerReferred(offer, capRedirectId, 'capsClicksOverLimit', 'capsClicksOverLimitCapRedirect')

      }

    }

    if (capInfo.capsSalesOverLimit) {

      if (salesRedirectOfferUseDefault) {
        capInfo.exitTrafficSales = true
        await offerReferred(offer, offer.offerIdRedirectExitTraffic, 'capsSalesOverLimit', 'capsSalesOverLimitExitTraffic')

      } else {
        capInfo.capSalesRedirect = true
        await offerReferred(offer, capSalesRedirectOfferId, 'capsSalesOverLimit', 'capsSalesOverLimitCapRedirect')

      }
    }

    offer.capInfo = capInfo
    return offer
  } catch (e) {
    console.log(e)
    influxdb(500, `re_calculate_offer_caps_error`)
  }
}

const offerReferred = async (offer: IOffer, referredOfferId: number, redirectType: string, redirectReason: string) => {
  offer.landingPageUrlOrigin = offer.landingPageUrl || ''
  offer.offerIdOrigin = offer.offerId || 0
  offer.referredOfferId = referredOfferId || 0
  offer.redirectType = redirectType
  offer.redirectReason = redirectReason
}
