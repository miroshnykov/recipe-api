import axios from "axios"
import {insertBrokenLinks} from "../models/testLinksModel";
import {influxdb} from "../metrics";
import {IOffer} from "../interfaces/offers";
import {getOffers} from "../models/offersModel";
import consola from "consola";
import {ICampaign} from "../interfaces/campaigns";
import {getCampaigns} from "../models/campaignsModel";
const trafficUrl = 'https://co-traffic.jatun.systems/'
//const trafficUrl = 'http://localhost:5000/'

export const testLinksOffers = async () => {
  try {
    let offers: IOffer[] = await getOffers() || []
    let brokenOfferIds = []
    for (const offer of offers) {
      const brokenOffer = await runLinksOffer(offer.offerId)
      if (brokenOffer.length !== 0) {
        brokenOfferIds.push(offer.offerId)
      }
    }
    consola.info(`brokenOfferIds:${JSON.stringify(brokenOfferIds)}`)
    return brokenOfferIds
  } catch (e) {
    consola.info('testLinksOfferError:', e)
  }
}

export const testLinksCampaigns = async () => {
  try {
    let brokenCampaignIds = []
    const campaigns: ICampaign[] = await getCampaigns()
    for (const campaign of campaigns) {
      const brokenCampaign = await runLinksCampaign(campaign.campaignId)
      if (brokenCampaign.length !== 0) {
        brokenCampaignIds.push(campaign.campaignId)
      }
    }
    consola.info(`brokenCampaignIds:${JSON.stringify(brokenCampaignIds)}`)
    return brokenCampaignIds
  } catch (e) {
    consola.info('testLinksCampaignsError:', e)
  }
}

const runLinksOffer = async (offerId: number) => {
  try {
    let {data} = await axios.get(`${trafficUrl}getRecipeData?debugging=debugging&offerId=${offerId}`)
    const offerInfo = data?.data?.offer || null
    const landingPageUrl = data?.data?.offer?.landingPageUrl || null
    let brokenOffer = []

    if (!offerInfo) {
      const obj = {
        entityId: offerId,
        entityType: 'offer',
        details: 'offerInfo empty',
        errors: 'offerInfo empty'
      }
      brokenOffer.push(obj)
      influxdb(200, `broken_recipe_offer_id_${offerId}`)
      await insertBrokenLinks(obj)
    }

    return brokenOffer

  } catch (e) {
    consola.error('runLinksOfferError:', e)
    return []
  }
}

const runLinksCampaign = async (campaignId: number) => {
  try {
    let {data} = await axios.get(`${trafficUrl}getRecipeData?debugging=debugging&campaignId=${campaignId}`)
    let brokenCampaign = []
    const campaignInfo = data?.data?.campaign || null
    if (!campaignInfo) {
      const obj = {
        entityId: campaignId,
        entityType: 'campaign',
        details: 'campaignInfo empty',
        errors: 'campaignInfo empty'
      }
      brokenCampaign.push(obj)
      influxdb(200, `broken_recipe_campaign_id_${campaignId}`)
      await insertBrokenLinks(obj)
    }

    return brokenCampaign
  } catch (e) {
    consola.info('runLinksCampaignError:', e)
    return []
  }

}