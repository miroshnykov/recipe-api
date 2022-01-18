import { IOffer, IOffersMargin } from '../interfaces/offers';
// eslint-disable-next-line import/no-cycle
import { getOffer } from '../models/offersModel';
// eslint-disable-next-line import/no-cycle
import { capsOffersRecalculate, countriesRestrictions, useStartEndDateCheck } from './offersReCalculations';

export const calculateMargin = (offersAggregated: IOffersMargin[]) => offersAggregated.map((i: any) => {
  let margin: number;
  if (i.rate) {
    const payInEx: number = Number(i.payin) * Number(i.rate);
    const payOutEx: number = Number(i.payout) * Number(i.rate);
    margin = Math.round((payInEx - payOutEx + Number.EPSILON) * 100) / 100;
  } else {
    margin = Math.round((Number(i.payin) - Number(i.payout) + Number.EPSILON) * 100) / 100;
  }
  const { aggregatedOfferId } = i;

  return {
    aggregatedOfferId,
    margin,
  };
}).sort((a: IOffersMargin, b: IOffersMargin) => ((a.margin > b.margin) ? -1 : 1));

export const recalculateChildOffers = async (marginOffers: IOffersMargin[]) => {
  const marginOffersResponse: any = [];
  await Promise.all(marginOffers.map(async (offer: IOffersMargin) => {
    const offerClone = { ...offer };
    const offerData: IOffer = await getOffer(offerClone.aggregatedOfferId);

    const countriesRestrictionsRes = countriesRestrictions(offerData);
    if (countriesRestrictionsRes.success) {
      offerClone.countriesRestrictions = countriesRestrictionsRes?.offer?.countriesRestrictions;
    }

    const capsOffersRecalculateRes = await capsOffersRecalculate(offerData);
    if (capsOffersRecalculateRes.success) {
      offerClone.capsOverLimitSales = capsOffersRecalculateRes?.offer?.capInfo?.capsSalesOverLimit!;
      offerClone.capsOverLimitClicks = capsOffersRecalculateRes?.offer?.capInfo?.capsClicksOverLimit!;
    }

    const useStartEndDateCheckRes = await useStartEndDateCheck(offerData);
    if (useStartEndDateCheckRes.success) {
      offerClone.dateRangeNotPass = useStartEndDateCheckRes?.offer?.startEndDateSetting?.dateRangePass;
    }

    marginOffersResponse.push(offerClone);
  }));

  return marginOffersResponse;
};
