import { IOffer, IOffersMargin } from '../interfaces/offers';
// eslint-disable-next-line import/no-cycle
import { getOffer } from '../models/offersModel';
// eslint-disable-next-line import/no-cycle
import { reCalculateOffer } from './offersCaps';

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

export const recalculateChildOffers = async (formatOffers: any) => {
  const offersFormat: any = [];
  await Promise.all(formatOffers.map(async (offer: any) => {
    const offerClone = { ...offer };
    const offerData: IOffer = await getOffer(offerClone.aggregatedOfferId);
    const offerInfo = await reCalculateOffer(offerData);

    if ('capsEnabled' in offerInfo && offerInfo?.capsEnabled!) {
      if (offerInfo?.capInfo?.capsSalesOverLimit) {
        offerClone.capsOverLimitSales = offerInfo?.capInfo?.capsSalesOverLimit;
      }
      if (offerInfo?.capInfo?.capsClicksOverLimit) {
        offerClone.capsOverLimitClicks = offerInfo?.capInfo?.capsClicksOverLimit;
      }
    }

    if ('startEndDateSetup' in offerInfo && offerInfo.startEndDateSetup) {
      // @ts-ignore
      if (!offerInfo.startEndDateSetting.dateRangePass) {
        offerClone.dateRangeNotPass = true;
      }
    }

    offerClone.countriesRestrictions = offerData.countriesRestrictions;

    const customLpRules = JSON.parse(offerData.customLpRules);
    if (customLpRules) {
      const customLpCountriesList = customLpRules.customLPRules.map((i: { country: string; }) => (i.country));
      if (customLpCountriesList.length !== 0) {
        offerClone.customLpCountriesRestrictions = customLpCountriesList.join(',');
      }
    }
    offersFormat.push(offerClone);
  }));

  return offersFormat;
};
