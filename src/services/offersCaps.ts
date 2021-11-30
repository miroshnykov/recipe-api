import consola from "consola";
import {getAggregatedOffers, getOfferCaps, getCustomPayoutPerGeo, getOffer} from "../models/offersModel";
import {influxdb} from "../metrics";

import {EXIT_OFFERS_NESTED_LIMIT, IOffer} from "../interfaces/offers"
import {ICapInfo, ICapResult, ICaps, ICapsType} from "../interfaces/caps"
import {IRedirectReason, IRedirectType} from "../interfaces/recipeTypes";

export const reCalculateOffer = async (offer: IOffer) => {
  try {
    if (offer.type === 'aggregated') {
      offer.offersAggregatedIds = await getAggregatedOffers(offer.offerId) || []
      return offer
    }

    if (offer.geoRules) {
      const geoRules = JSON.parse(offer.geoRules)
      if (geoRules.geo) {
        const countriesList = geoRules?.geo?.map((i: { country: string; }) => (i.country))
        if (countriesList.length !== 0) {
          offer.countriesRestrictions = countriesList.join(',')
          offer.geoRules = ''
        }
      }
    }
    if (offer.capsEnabled) {
      let offerCaps = await reCalculateOfferCaps(offer.offerId)
      if (offerCaps?.capSetup && offerCaps?.capInfo) {
        offer.capInfo = offerCaps.capInfo
        offer.capSetup = offerCaps.capSetup
        offer.landingPageUrlOrigin = offerCaps.landingPageUrl
        offer.redirectType = offerCaps.redirectType
        offer.redirectReason = offerCaps.redirectReason
      }
      consola.info(`OfferId:${offer.offerId}`)
      offer.exitOffersNested = await exitOffersNested(offer)
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

const exitOffersNested = async (offer: IOffer) => {
  const limitNested: number = EXIT_OFFERS_NESTED_LIMIT
  let exitOffersNested: IOffer[] = []
  let count: number = 0
  const recurseCheckExitOffer = async (offer: IOffer): Promise<any> => {

    if (offer.offerIdRedirectExitTraffic
      && offer?.capInfo?.isExitTraffic
      && count < limitNested
    ) {
      const tempOffer = await reCalculateOfferCaps(offer.offerIdRedirectExitTraffic)
      if (tempOffer?.capInfo?.isExitTraffic) {
        count++
        consola.info(` -> nested exit offerId:${tempOffer.offerId}, count:${count}`)
        exitOffersNested.push(tempOffer)
      }
      return recurseCheckExitOffer(tempOffer!)
    } else {
      return
    }
  }

  await recurseCheckExitOffer(offer)
  return exitOffersNested
}

export const reCalculateOfferCaps = async (offerId: number) => {
  try {
    let offer: IOffer = await getOffer(offerId)
    if (offer.status === 'inactive') {
      return offer
    }
    if (!offer.capsEnabled) {
      return offer
    }
    let offerCaps: ICaps = await getOfferCaps(offerId)
    const {
      clicksDaySetUpLimit,
      clicksWeekSetUpLimit,
      clicksMonthSetupLimit,
      clicksDayCurrent,
      clicksWeekCurrent,
      clicksMonthCurrent,
      clicksRedirectOfferId,
      clicksRedirectOfferUseDefault,
      salesDaySetUpLimit,
      salesWeekSetUpLimit,
      salesMonthSetupLimit,
      salesDayCurrent,
      salesWeekCurrent,
      salesMonthCurrent,
      salesRedirectOfferId,
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
      capsType: null,
      capsSalesUnderLimit: null,
      capsSalesUnderLimitDetails: null,
      capsSalesOverLimit: null,
      capsSalesOverLimitDetails: null,
      capsClicksUnderLimit: null,
      capsClicksUnderLimitDetails: null,
      capsClicksOverLimit: null,
      capsClicksOverLimitDetails: null,
      exitTrafficSales: null,
      exitTrafficClicks: null,
      isExitTraffic: false
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
        capInfo.capsType = ICapsType.CAPS_OFFER_DATA_RANGE_NOT_PASS
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

    const conditionsSetupSales: ICapResult[] = [
      {
        "period": "day",
        "limit": salesDaySetUpLimit,
        "currentAmount": salesDayCurrent
      },
      {
        "period": "week",
        "limit": salesWeekSetUpLimit,
        "currentAmount": salesWeekCurrent
      },
      {
        "period": "month",
        "limit": salesMonthSetupLimit,
        "currentAmount": salesMonthCurrent
      },
    ]
    const conditionsSetupSalesNotEmpty = conditionsSetupSales.filter(i => (i.limit))

    const salesResultUnderLimit: ICapResult[] = []
    const salesResultOverLimit: ICapResult[] = []
    conditionsSetupSalesNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        salesResultUnderLimit.push(i)
      } else {
        salesResultOverLimit.push(i)
      }
    })

    if (salesResultUnderLimit.length !== 0
      && salesResultUnderLimit.length === conditionsSetupSalesNotEmpty.length
    ) {
      capInfo.capsSalesUnderLimit = true
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',')
      capInfo.capsType = ICapsType.CAPS_OFFER_UNDER_LIMIT
    } else {
      capInfo.capsSalesUnderLimit = false
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',')
    }

    if (salesResultOverLimit.length !== 0) {
      capInfo.capsSalesOverLimit = true
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',')
    } else {
      capInfo.capsSalesOverLimit = false
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',')
    }

    capInfo.clicks.day.current = clicksDayCurrent
    capInfo.clicks.day.limit = clicksDaySetUpLimit

    capInfo.clicks.week.current = clicksWeekCurrent
    capInfo.clicks.week.limit = clicksWeekSetUpLimit

    capInfo.clicks.month.current = clicksMonthCurrent
    capInfo.clicks.month.limit = clicksMonthSetupLimit

    const conditionsSetupClicks: ICapResult[] = [
      {
        "period": "day",
        "limit": clicksDaySetUpLimit,
        "currentAmount": clicksDayCurrent
      },
      {
        "period": "week",
        "limit": clicksWeekSetUpLimit,
        "currentAmount": clicksWeekCurrent
      },
      {
        "period": "month",
        "limit": clicksMonthSetupLimit,
        "currentAmount": clicksMonthCurrent
      },
    ]
    const conditionsSetupClicksNotEmpty = conditionsSetupClicks.filter(i => (i.limit))

    const clicksResultUnderLimit: ICapResult[] = []
    const clicksResultOverLimit: ICapResult[] = []
    conditionsSetupClicksNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        clicksResultUnderLimit.push(i)
      } else {
        clicksResultOverLimit.push(i)
      }
    })

    if (clicksResultUnderLimit.length !== 0
      && clicksResultUnderLimit.length === conditionsSetupClicksNotEmpty.length
    ) {
      capInfo.capsClicksUnderLimit = true
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',')
      capInfo.capsType = ICapsType.CAPS_OFFER_UNDER_LIMIT
    } else {
      capInfo.capsClicksUnderLimit = false
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',')
    }

    if (clicksResultOverLimit.length !== 0) {
      capInfo.capsClicksOverLimit = true
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',')
    } else {
      capInfo.capsClicksOverLimit = false
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',')
    }

    if (capInfo.capsClicksOverLimit) {
      if (clicksRedirectOfferUseDefault) {
        capInfo.exitTrafficClicks = true
        capInfo.isExitTraffic = true
        capInfo.offerCapsOfferIdRedirect = offer.offerIdRedirectExitTraffic
        await setRedirectInfo(
          offer,
          IRedirectType.CAPS_OFFERS_CLICKS_OVER_LIMIT,
          IRedirectReason.CAPS_OFFERS_CLICKS_OVER_LIMIT_EXIT_TRAFFIC
        )
      } else {
        capInfo.capClicksRedirect = true
        capInfo.offerCapsOfferIdRedirect = clicksRedirectOfferId
        await setRedirectInfo(
          offer,
          IRedirectType.CAPS_OFFERS_CLICKS_OVER_LIMIT,
          IRedirectReason.CAPS_OFFERS_CLICKS_OVER_LIMIT_CAP_REDIRECT
        )
      }
      capInfo.capsType = ICapsType.CAPS_OFFER_OVER_LIMIT_ClICKS
    }

    if (capInfo.capsSalesOverLimit) {
      if (salesRedirectOfferUseDefault) {
        capInfo.exitTrafficSales = true
        capInfo.isExitTraffic = true
        capInfo.offerCapsOfferIdRedirect = offer.offerIdRedirectExitTraffic
        await setRedirectInfo(
          offer,
          IRedirectType.CAPS_OFFERS_SALES_OVER_LIMIT,
          IRedirectReason.CAPS_OFFERS_SALES_OVER_LIMIT_EXIT_TRAFFIC)
      } else {
        capInfo.capSalesRedirect = true
        capInfo.offerCapsOfferIdRedirect = salesRedirectOfferId
        await setRedirectInfo(
          offer,
          IRedirectType.CAPS_OFFERS_SALES_OVER_LIMIT,
          IRedirectReason.CAPS_OFFERS_SALES_OVER_LIMIT_CAP_REDIRECT)
      }
      capInfo.capsType = ICapsType.CAPS_OFFER_OVER_LIMIT_SALES
    }

    offer.capInfo = capInfo
    return offer
  } catch (e) {
    console.log(e)
    influxdb(500, `re_calculate_offer_caps_error`)
  }
}

const setRedirectInfo = async (
  offer: IOffer,
  redirectType: IRedirectType,
  redirectReason: IRedirectReason
) => {
  offer.redirectType = redirectType
  offer.redirectReason = redirectReason
}
