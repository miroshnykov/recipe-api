import {IOffer, IOfferStatus} from "../interfaces/offers";
import {findAggregatedOffer, getOffer} from "../models/offersModel";
import {ISqsMessage, ISqsMessageAction, ISqsMessageType} from "../interfaces/sqsMessage";
import {influxdb} from "../metrics";
import {reCalculateOffer} from "./offersCaps";
import {ICampaign} from "../interfaces/campaigns";
import {getCampaign} from "../models/campaignsModel";
import {reCalculateCampaignCaps} from "./campaignsCaps";
import {deleteMessage} from "../sqs";

export const recalculateRecipe = async (message: any) => {
  let responseEntity = []
  try {
    const messageBody = JSON.parse(message.Body!)

    switch (messageBody.type) {
      case ISqsMessageType.OFFER:
        let resOffer = await offerReCalculate(messageBody)
        responseEntity.push(resOffer)
        break;
      case ISqsMessageType.CAMPAIGN:
        let response = await campaignReCalculate(messageBody)
        responseEntity.push(response)
        break;
      default:
    }

    await deleteMessage(message.ReceiptHandle!)
    return responseEntity.flat()
  } catch (e) {
    return []
  }
}

const offerReCalculate = async (messageBody: ISqsMessage) => {
  let messageResponse = []

  switch (messageBody.action) {
    case ISqsMessageAction.UPDATE_OR_CREATE:
      let offerResponse = await offerUpdateOrCreate(messageBody)
      messageResponse.push(offerResponse)
      break;
    case ISqsMessageAction.DELETE:
      influxdb(200, `sqs_offer_delete`)
      messageResponse.push(messageBody)
      break;
    default:
      messageResponse.push(messageBody)
  }
  return messageResponse.flat()
}

const offerUpdateOrCreate = async (messageBody: ISqsMessage) => {
  let offer: IOffer = await getOffer(messageBody.id)
  const projectName = messageBody?.project || ''
  let messageResponse = []
  switch (offer.status) {
    case IOfferStatus.INACTIVE:
      let generateOfferBodyForDelete: ISqsMessage = {
        comments: 'offer status inactive, lets delete from recipe',
        type: ISqsMessageType.OFFER,
        id: messageBody.id,
        project: messageBody.project || '',
        action: ISqsMessageAction.DELETE,
        timestamp: Date.now(),
        body: ``
      }

      influxdb(200, `sqs_offer_inactive_${projectName}`)
      messageResponse.push(generateOfferBodyForDelete)
      break;
    case IOfferStatus.PUBLIC:
    case IOfferStatus.PENDING:
    case IOfferStatus.APPLY_TO_RUN:
    case IOfferStatus.PRIVATE:
      let reCalculatedOffer: IOffer | any = await reCalculateOffer(offer)
      let generateOfferBody: ISqsMessage = {
        comments: messageBody.comments,
        type: ISqsMessageType.OFFER,
        id: messageBody.id,
        action: messageBody.action,
        project: messageBody.project || '',
        timestamp: Date.now(),
        body: `${JSON.stringify(reCalculatedOffer)}`
      }

      // messages.push(JSON.parse(generateOfferBody))
      influxdb(200, `sqs_offer_update_or_create_${projectName}`)
      messageResponse.push(generateOfferBody)

      // PH-328
      let findAgg = await findAggregatedOffer(messageBody.id)
      if (findAgg.sfl_offer_aggregated_id) {
        let offer: IOffer = await getOffer(findAgg.sfl_offer_aggregated_id)
        let reCalculateAggregatedOffer: IOffer | any = await reCalculateOffer(offer)
        let aggrOfferBody: ISqsMessage = {
          comments: 'recalculate aggregated offer',
          type: ISqsMessageType.OFFER,
          id: findAgg.sfl_offer_aggregated_id,
          action: ISqsMessageAction.UPDATE_OR_CREATE,
          timestamp: Date.now(),
          project: messageBody.project || '',
          body: `${JSON.stringify(reCalculateAggregatedOffer)}`
        }
        influxdb(200, `sqs_offer_update_aggregated_${projectName}`)
        messageResponse.push(aggrOfferBody)
      }

      break;
    default:
  }
  return messageResponse.flat()
}

const campaignReCalculate = async (messageBody: ISqsMessage) => {
  let messageResponse = []
  const projectName = messageBody?.project || ''
  switch (messageBody.action) {
    case ISqsMessageAction.UPDATE_OR_CREATE:
      let campaignInfo: ICampaign = await getCampaign(messageBody.id)
      let reCalcCampaign: ICampaign | any[] = await reCalculateCampaignCaps(campaignInfo.campaignId)
      let generateCampaignBody: ISqsMessage = {
        comments: messageBody.comments,
        type: ISqsMessageType.CAMPAIGN,
        id: messageBody.id,
        action: messageBody.action,
        project: messageBody.project || '',
        timestamp: Date.now(),
        body: `${JSON.stringify(reCalcCampaign)}`
      }
      influxdb(200, `sqs_campaign_update_or_create_${projectName}`)
      messageResponse.push(generateCampaignBody)
      break;
    case ISqsMessageAction.DELETE:
      influxdb(200, `sqs_campaign_delete`)
      messageResponse.push(messageBody)
      break;
    default:
      messageResponse.push(messageBody)
  }
  return messageResponse.flat()
}