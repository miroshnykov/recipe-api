import consola from 'consola';
// eslint-disable-next-line import/no-cycle
import {
  getAggregatedOffers, getOfferCaps, getCustomPayoutPerGeo, getOffer,
} from '../models/offersModel';
import { influxdb } from '../metrics';

import { IOffer, IOffersMargin } from '../interfaces/offers';
import {
  ICapInfo, ICapResult, ICaps, ICapsType,
} from '../interfaces/caps';
import { IRedirectReason, IRedirectType } from '../interfaces/recipeTypes';
// eslint-disable-next-line import/no-cycle
import { calculateMargin, recalculateChildOffers } from './aggregatedOffer';

export const countriesRestrictions = (offer: IOffer) => {
  const offerClone = { ...offer };
  let pass: boolean = false;
  if (offerClone.geoRules) {
    try {
      const geoRules = JSON.parse(offerClone.geoRules);
      if (geoRules.geo) {
        const countriesList = geoRules?.geo?.map((i: { country: string; }) => (i.country));
        if (countriesList.length !== 0) {
          offerClone.countriesRestrictions = countriesList.join(',');
          pass = true;
        }
      }
    } catch (e) {
      consola.error(`Wrong format for offerId:${offerClone.offerId} `, offerClone.geoRules);
      influxdb(500, 're_calculate_offer_geo_wrong_format_error');
    }
  }

  return {
    success: pass,
    offer: offerClone,
  };
};

export const capsOffersRecalculate = async (offer: IOffer) => {
  let pass: boolean = false;
  const offerClone = { ...offer };
  if (offerClone.capsEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const offerCaps = await reCalculateOfferCaps(offerClone.offerId);
    if (offerCaps?.capSetup && offerCaps?.capInfo) {
      offerClone.capInfo = offerCaps.capInfo;
      offerClone.capSetup = offerCaps.capSetup;
      offerClone.landingPageUrlOrigin = offerCaps.landingPageUrl;
      offerClone.redirectType = offerCaps.redirectType;
      offerClone.redirectReason = offerCaps.redirectReason;
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    offerClone.exitOffersNested = await exitOffersNested(offerClone);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    offerClone.exitOfferDetected = offerClone.exitOffersNested.length !== 0 ? exitOfferDetecting(offerClone.exitOffersNested) : [];
    pass = true;
  }

  return {
    success: pass,
    offer: offerClone,
  };
};

export const useStartEndDateCheck = async (offer: IOffer) => {
  let pass: boolean = false;
  const offerClone = { ...offer };
  if (offerClone.useStartEndDate) {
    offerClone.startEndDateSetup = true;
    const currentDate = new Date();
    offerClone.startEndDateSetting = {
      startDate: offerClone.startDate,
      endDate: offerClone.endDate,
      dateRangePass: currentDate > offerClone.startDate && currentDate < offerClone.endDate,
    };
    pass = true;
  }
  return {
    success: pass,
    offer: offerClone,
  };
};

export const customPayOutCheck = async (offer: IOffer) => {
  let pass: boolean = false;
  const offerClone = { ...offer };
  if (offerClone.customPayOutCount > 0) {
    const customPayOutData = await getCustomPayoutPerGeo(offerClone.offerId);
    offerClone.customPayOutPerGeo = JSON.stringify(customPayOutData);
    pass = true;
  }
  return {
    success: pass,
    offer: offerClone,
  };
};

export const reCalculateOffer = async (offer: IOffer) => {
  try {
    let offerClone = { ...offer };
    if (offerClone.type === 'aggregated') {
      const offersAggregated = await getAggregatedOffers(offerClone.offerId) || [];
      const marginOffers: IOffersMargin[] = calculateMargin(offersAggregated);
      offerClone.offersAggregatedIds = await recalculateChildOffers(marginOffers);
    }
    const countriesRestrictionsRes = countriesRestrictions(offerClone);
    if (countriesRestrictionsRes.success) {
      offerClone = { ...countriesRestrictionsRes.offer, ...offerClone };
    }

    const capsOffersRecalculateRes = await capsOffersRecalculate(offerClone);
    if (capsOffersRecalculateRes.success) {
      offerClone = { ...capsOffersRecalculateRes.offer, ...offerClone };
    }

    const useStartEndDateCheckRes = await useStartEndDateCheck(offerClone);
    if (useStartEndDateCheckRes.success) {
      offerClone = { ...useStartEndDateCheckRes.offer, ...offerClone };
    }

    const customPayOutCheckRes = await customPayOutCheck(offerClone);
    if (customPayOutCheckRes.success) {
      offerClone = { ...customPayOutCheckRes.offer, ...offerClone };
    }

    offerClone.payin = Number(offerClone.payin);
    offerClone.payout = Number(offerClone.payout);
    return offerClone;
  } catch (e) {
    consola.error('reCalculateOfferError:', e);
    influxdb(500, 're_calculate_offer_error');
    return [];
  }
};

const exitOffersNested = async (offer: IOffer) => {
  // const limitNested: number = EXIT_OFFERS_NESTED_LIMIT;
  const exitOffersNestedArr: IOffer[] = [];
  const parentOffer: IOffer[] = [];
  const limitNested = 10;
  let count: number = 0;
  // eslint-disable-next-line @typescript-eslint/no-shadow,consistent-return
  const recurseCheckExitOffer = async (offer: IOffer): Promise<any> => {
    if (offer.offerIdRedirectExitTraffic
      && count < limitNested
    ) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      const tempOffer = await reCalculateOfferCaps(offer.offerIdRedirectExitTraffic);
      if (tempOffer?.offerIdRedirectExitTraffic) {
        count++;

        exitOffersNestedArr.push(tempOffer);
        parentOffer.push(offer);
        // const str = count === 1 ? `\nHead offerId:${parentOffer[0].offerId}, name:${parentOffer[0].name} \n` : '';
        // if (count < 2) {
        //  consola.info(`${str} -> nested exit offerId:${tempOffer.offerId}, name:${tempOffer.name} isExitTraffic:${tempOffer?.capInfo?.isExitTraffic} count:${count}, parent offer:${JSON.stringify(parentOffer.map((i) => i.offerId))}`);
        // }
      }
      return recurseCheckExitOffer(tempOffer!);
    }
  };

  await recurseCheckExitOffer(offer);
  return exitOffersNestedArr;
};

const exitOfferDetecting = (offers: IOffer[]) => {
  let exitTrafficFilterResult: any = [];
  if (offers.length !== 0) {
    const exitTrafficFilter = offers.filter((i) => !i.capInfo?.isExitTraffic);
    if (exitTrafficFilter.length !== 0) {
      [exitTrafficFilterResult] = exitTrafficFilter;
    }
    // consola.info(` --> exitOfferDetecting offerId:${exitTrafficFilterResult.offerId}, name:${exitTrafficFilterResult.name} isExitTraffic:${exitTrafficFilterResult.capInfo?.isExitTraffic}`);
  }
  return exitTrafficFilterResult;
};

// eslint-disable-next-line consistent-return
export const reCalculateOfferCaps = async (offerId: number) => {
  try {
    const offer: IOffer = await getOffer(offerId);
    if (offer.status === 'inactive'
      || offer.status === 'draft'
    ) {
      return offer;
    }
    if (!offer.capsEnabled) {
      return offer;
    }
    const offerCaps: ICaps = await getOfferCaps(offerId);
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
      useStartEndDate,
    } = offerCaps;

    if (!clicksDaySetUpLimit
      && !clicksWeekSetUpLimit
      && !clicksMonthSetupLimit
      && !salesDaySetUpLimit
      && !salesWeekSetUpLimit
      && !salesMonthSetupLimit
    ) {
      return offer;
    }
    const offerClone = { ...offer };
    offerClone.capSetup = true;
    const capInfo: ICapInfo = {
      sales: {
        day: {
          current: 0,
          limit: 0,
        },
        week: {
          current: 0,
          limit: 0,
        },
        month: {
          current: 0,
          limit: 0,
        },
      },
      clicks: {
        day: {
          current: 0,
          limit: 0,
        },
        week: {
          current: 0,
          limit: 0,
        },
        month: {
          current: 0,
          limit: 0,
        },
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
      isExitTraffic: false,
    };

    if (useStartEndDate && capsStartDate && capsEndDate) {
      capInfo.dateRangeSetUp = true;
      capInfo.dateStart = capsStartDate;
      capInfo.dateEnd = capsEndDate;
      const currentDate = new Date();
      capInfo.currentDate = capsEndDate;
      capInfo.dateRangePass = currentDate > capsStartDate && currentDate < capsEndDate;

      if (!capInfo.dateRangePass) {
        capInfo.dateRangeNotPassDescriptions = `capsStartDate:${capsStartDate} capsEndDate:${capsEndDate}`;
        capInfo.capsType = ICapsType.CAPS_OFFER_DATA_RANGE_NOT_PASS;
        offerClone.capInfo = capInfo;
        return offerClone;
      }
    }

    capInfo.sales.day.current = salesDayCurrent;
    capInfo.sales.day.limit = salesDaySetUpLimit;

    capInfo.sales.week.current = salesWeekCurrent;
    capInfo.sales.week.limit = salesWeekSetUpLimit;

    capInfo.sales.month.current = salesMonthCurrent;
    capInfo.sales.month.limit = salesMonthSetupLimit;

    const conditionsSetupSales: ICapResult[] = [
      {
        period: 'day',
        limit: salesDaySetUpLimit,
        currentAmount: salesDayCurrent,
      },
      {
        period: 'week',
        limit: salesWeekSetUpLimit,
        currentAmount: salesWeekCurrent,
      },
      {
        period: 'month',
        limit: salesMonthSetupLimit,
        currentAmount: salesMonthCurrent,
      },
    ];
    const conditionsSetupSalesNotEmpty = conditionsSetupSales.filter((i) => (i.limit));

    const salesResultUnderLimit: ICapResult[] = [];
    const salesResultOverLimit: ICapResult[] = [];
    conditionsSetupSalesNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        salesResultUnderLimit.push(i);
      } else {
        salesResultOverLimit.push(i);
      }
    });

    if (salesResultUnderLimit.length !== 0
      && salesResultUnderLimit.length === conditionsSetupSalesNotEmpty.length
    ) {
      capInfo.capsSalesUnderLimit = true;
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
      capInfo.capsType = ICapsType.CAPS_OFFER_UNDER_LIMIT;
    } else {
      capInfo.capsSalesUnderLimit = false;
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (salesResultOverLimit.length !== 0) {
      capInfo.capsSalesOverLimit = true;
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    } else {
      capInfo.capsSalesOverLimit = false;
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    capInfo.clicks.day.current = clicksDayCurrent;
    capInfo.clicks.day.limit = clicksDaySetUpLimit;

    capInfo.clicks.week.current = clicksWeekCurrent;
    capInfo.clicks.week.limit = clicksWeekSetUpLimit;

    capInfo.clicks.month.current = clicksMonthCurrent;
    capInfo.clicks.month.limit = clicksMonthSetupLimit;

    const conditionsSetupClicks: ICapResult[] = [
      {
        period: 'day',
        limit: clicksDaySetUpLimit,
        currentAmount: clicksDayCurrent,
      },
      {
        period: 'week',
        limit: clicksWeekSetUpLimit,
        currentAmount: clicksWeekCurrent,
      },
      {
        period: 'month',
        limit: clicksMonthSetupLimit,
        currentAmount: clicksMonthCurrent,
      },
    ];
    const conditionsSetupClicksNotEmpty = conditionsSetupClicks.filter((i) => (i.limit));

    const clicksResultUnderLimit: ICapResult[] = [];
    const clicksResultOverLimit: ICapResult[] = [];
    conditionsSetupClicksNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        clicksResultUnderLimit.push(i);
      } else {
        clicksResultOverLimit.push(i);
      }
    });

    if (clicksResultUnderLimit.length !== 0
      && clicksResultUnderLimit.length === conditionsSetupClicksNotEmpty.length
    ) {
      capInfo.capsClicksUnderLimit = true;
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
      capInfo.capsType = ICapsType.CAPS_OFFER_UNDER_LIMIT;
    } else {
      capInfo.capsClicksUnderLimit = false;
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (clicksResultOverLimit.length !== 0) {
      capInfo.capsClicksOverLimit = true;
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    } else {
      capInfo.capsClicksOverLimit = false;
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (capInfo.capsClicksOverLimit) {
      if (clicksRedirectOfferUseDefault) {
        capInfo.exitTrafficClicks = true;
        capInfo.isExitTraffic = true;
        capInfo.offerCapsOfferIdRedirect = offerClone.offerIdRedirectExitTraffic;
        offerClone.redirectType = IRedirectType.CAPS_OFFERS_CLICKS_OVER_LIMIT;
        offerClone.redirectReason = IRedirectReason.CAPS_OFFERS_CLICKS_OVER_LIMIT_EXIT_TRAFFIC;
      } else {
        capInfo.capClicksRedirect = true;
        capInfo.offerCapsOfferIdRedirect = clicksRedirectOfferId;
        offerClone.redirectType = IRedirectType.CAPS_OFFERS_CLICKS_OVER_LIMIT;
        offerClone.redirectReason = IRedirectReason.CAPS_OFFERS_CLICKS_OVER_LIMIT_CAP_REDIRECT;
      }
      capInfo.capsType = ICapsType.CAPS_OFFER_OVER_LIMIT_ClICKS;
    }

    if (capInfo.capsSalesOverLimit) {
      if (salesRedirectOfferUseDefault) {
        capInfo.exitTrafficSales = true;
        capInfo.isExitTraffic = true;
        capInfo.offerCapsOfferIdRedirect = offerClone.offerIdRedirectExitTraffic;
        offerClone.redirectType = IRedirectType.CAPS_OFFERS_SALES_OVER_LIMIT;
        offerClone.redirectReason = IRedirectReason.CAPS_OFFERS_SALES_OVER_LIMIT_EXIT_TRAFFIC;
      } else {
        capInfo.capSalesRedirect = true;
        capInfo.offerCapsOfferIdRedirect = salesRedirectOfferId;
        offerClone.redirectType = IRedirectType.CAPS_OFFERS_SALES_OVER_LIMIT;
        offerClone.redirectReason = IRedirectReason.CAPS_OFFERS_SALES_OVER_LIMIT_CAP_REDIRECT;
      }
      capInfo.capsType = ICapsType.CAPS_OFFER_OVER_LIMIT_SALES;
    }

    offerClone.capInfo = capInfo;
    return offerClone;
  } catch (e) {
    consola.error('reCalculateOfferCapsError:', e);
    influxdb(500, 're_calculate_offer_caps_error');
  }
};
