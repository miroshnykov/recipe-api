import axios from 'axios';
import consola from 'consola';
import { insertBrokenLinks } from '../models/testLinksModel';
import { influxdb } from '../metrics';
import { IOffer } from '../interfaces/offers';
import { getOffers } from '../models/offersModel';
import { ICampaign } from '../interfaces/campaigns';
import { getCampaigns } from '../models/campaignsModel';

const trafficUrl: string = process.env.TRAFFIC_URL || '';
// const trafficUrl = 'http://localhost:5000/'

const runLinksOffer = async (offerId: number) => {
  try {
    const { data } = await axios.get(`${trafficUrl}getRecipeData?debugging=debugging&offerId=${offerId}`);
    const offerInfo = data?.data?.offer || null;
    const brokenOffer = [];

    if (!offerInfo) {
      const obj = {
        entityId: offerId,
        entityType: 'offer',
        details: 'offerInfo empty',
        errors: 'offerInfo empty',
      };
      brokenOffer.push(obj);
      influxdb(500, 'broken_recipe_offer');
      await insertBrokenLinks(obj);
    }

    return brokenOffer;
  } catch (e) {
    consola.error(`runLinksOfferError trafficUrl:${trafficUrl}`, e);
    return [];
  }
};

export const testLinksOffers = async () => {
  const offers: IOffer[] = await getOffers() || [];
  const brokenOfferIds: number[] = [];

  await Promise.all(offers.map(async (offer) => {
    const brokenOffer = await runLinksOffer(offer.offerId);
    if (brokenOffer.length !== 0) {
      brokenOfferIds.push(offer.offerId);
    }
  }));

  consola.info(`brokenOfferIds:${JSON.stringify(brokenOfferIds)}`);
  return brokenOfferIds;
};

const runLinksCampaign = async (campaignId: number) => {
  try {
    const { data } = await axios.get(`${trafficUrl}getRecipeData?debugging=debugging&campaignId=${campaignId}`);
    const brokenCampaign = [];
    const campaignInfo = data?.data?.campaign || null;
    if (!campaignInfo) {
      const obj = {
        entityId: campaignId,
        entityType: 'campaign',
        details: 'campaignInfo empty',
        errors: 'campaignInfo empty',
      };
      brokenCampaign.push(obj);
      influxdb(500, 'broken_recipe_campaign');
      await insertBrokenLinks(obj);
    }

    return brokenCampaign;
  } catch (e) {
    consola.info(`runLinksCampaignError trafficUrl:${trafficUrl}, err:`, e);
    return [];
  }
};

export const testLinksCampaigns = async () => {
  try {
    const brokenCampaignIds: number[] = [];
    const campaigns: ICampaign[] | undefined = await getCampaigns();
    if (!campaigns) {
      consola.error('recipe_campaigns_created_error');
      return;
    }

    await Promise.all(campaigns.map(async (campaign) => {
      const brokenCampaign = await runLinksCampaign(campaign.campaignId);
      if (brokenCampaign.length !== 0) {
        brokenCampaignIds.push(campaign.campaignId);
      }
    }));

    consola.info(`brokenCampaignIds:${JSON.stringify(brokenCampaignIds)}`);
    // eslint-disable-next-line consistent-return
    return brokenCampaignIds;
  } catch (e) {
    consola.info('testLinksCampaignsError:', e);
  }
};
