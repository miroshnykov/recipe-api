import consola from 'consola';
import { IOffer, IOffersMargin } from '../interfaces/offers';
// eslint-disable-next-line import/no-cycle
import { getOffer } from '../models/offersModel';
// eslint-disable-next-line import/no-cycle
import { influxdb } from '../metrics';

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
    try {
      const geoRules = JSON.parse(offerData.geoRules);

      if (geoRules.geo) {
        const countriesList = geoRules?.geo?.map((i: { country: string; }) => (i.country));
        if (countriesList.length !== 0) {
          offerClone.countriesRestrictions = countriesList.join(',');
        }
      }
    } catch (e) {
      consola.error(`Wrong format for offerId:${offerData.offerId} `, offerData.geoRules);
      influxdb(500, 're_calculate_offer_geo_wrong_format_error');
    }

    offersFormat.push(offerClone);
  }));

  return offersFormat;
};
