import consola from 'consola';
import { IOffer, IOfferStatus } from '../interfaces/offers';
import { findAggregatedOffer, getOffer } from '../models/offersModel';
import { ISqsMessage, ISqsMessageAction, ISqsMessageType } from '../interfaces/sqsMessage';
import { influxdb } from '../metrics';
import { reCalculateOffer } from './offersReCalculations';
import { ICampaign } from '../interfaces/campaigns';
import { getCampaign } from '../models/campaignsModel';
import { reCalculateCampaignCaps } from './campaignsCaps';
// eslint-disable-next-line import/no-cycle
import { deleteMessage } from '../sqs';

const offerUpdateOrCreate = async (messageBody: ISqsMessage): Promise<ISqsMessage[]> => {
  const offer: IOffer = await getOffer(messageBody.id);
  const projectName = messageBody?.project || '';
  const messageResponse = [];
  switch (offer.status) {
    case IOfferStatus.DRAFT: {
      const generateOfferBodyForDelete: ISqsMessage = {
        comments: 'offer status draft, lets delete from recipe',
        type: ISqsMessageType.OFFER,
        id: messageBody.id,
        project: messageBody.project || '',
        action: ISqsMessageAction.DELETE,
        timestamp: Date.now(),
        body: '',
      };

      influxdb(200, `sqs_offer_inactive_${projectName}`);
      messageResponse.push(generateOfferBodyForDelete);
      break;
    }
    case IOfferStatus.PUBLIC:
    case IOfferStatus.PENDING:
    case IOfferStatus.APPLY_TO_RUN:
    case IOfferStatus.INACTIVE:
    case IOfferStatus.PRIVATE: {
      const reCalculatedOffer: IOffer | any = await reCalculateOffer(offer);
      const generateOfferBody: ISqsMessage = {
        comments: messageBody.comments,
        type: ISqsMessageType.OFFER,
        id: messageBody.id,
        action: messageBody.action,
        project: messageBody.project || '',
        timestamp: Date.now(),
        body: `${JSON.stringify(reCalculatedOffer)}`,
      };

      // messages.push(JSON.parse(generateOfferBody))
      influxdb(200, `sqs_offer_update_or_create_${projectName}`);
      messageResponse.push(generateOfferBody);
      // PH-328
      const findAgg = await findAggregatedOffer(messageBody.id);
      if (findAgg.sfl_offer_aggregated_id) {
        const offerFoAggr: IOffer = await getOffer(findAgg.sfl_offer_aggregated_id);
        const reCalculateAggregatedOffer: IOffer | any = await reCalculateOffer(offerFoAggr);
        const aggrOfferBody: ISqsMessage = {
          comments: 'recalculate aggregated offer',
          type: ISqsMessageType.OFFER,
          id: findAgg.sfl_offer_aggregated_id,
          action: ISqsMessageAction.UPDATE_OR_CREATE,
          timestamp: Date.now(),
          project: messageBody.project || '',
          body: `${JSON.stringify(reCalculateAggregatedOffer)}`,
        };
        influxdb(200, `sqs_offer_update_aggregated_${projectName}`);
        messageResponse.push(aggrOfferBody);
      }
      break;
    }
    default:
      consola.info('offerReCalculate status not defined');
      influxdb(500, `sqs_offer_status_not_defined_${projectName}`);
  }
  return messageResponse.flat();
};

const offerReCalculate = async (messageBody: ISqsMessage): Promise<ISqsMessage[]> => {
  const messageResponse = [];

  switch (messageBody.action) {
    case ISqsMessageAction.UPDATE_OR_CREATE: {
      const offerResponse = await offerUpdateOrCreate(messageBody);
      messageResponse.push(offerResponse);
      break;
    }
    case ISqsMessageAction.DELETE: {
      influxdb(200, 'sqs_offer_delete');
      messageResponse.push(messageBody);
      break;
    }
    default:
      messageResponse.push(messageBody);
  }
  return messageResponse.flat();
};

const campaignReCalculate = async (messageBody: ISqsMessage): Promise<ISqsMessage[]> => {
  const messageResponse = [];
  const projectName = messageBody?.project || '';
  switch (messageBody.action) {
    case ISqsMessageAction.UPDATE_OR_CREATE: {
      const campaignInfo: ICampaign = await getCampaign(messageBody.id);
      const reCalcCampaign: ICampaign | any[] = await reCalculateCampaignCaps(campaignInfo.campaignId);
      const generateCampaignBody: ISqsMessage = {
        comments: messageBody.comments,
        type: ISqsMessageType.CAMPAIGN,
        id: messageBody.id,
        action: messageBody.action,
        project: messageBody.project || '',
        timestamp: Date.now(),
        body: `${JSON.stringify(reCalcCampaign)}`,
      };
      influxdb(200, `sqs_campaign_update_or_create_${projectName}`);
      messageResponse.push(generateCampaignBody);
      break;
    }

    case ISqsMessageAction.DELETE: {
      influxdb(200, 'sqs_campaign_delete');
      messageResponse.push(messageBody);
      break;
    }

    default:
      messageResponse.push(messageBody);
  }
  return messageResponse.flat();
};

export const recalculateRecipe = async (message: any): Promise<ISqsMessage[]> => {
  const responseEntity = [];
  try {
    const messageBody = JSON.parse(message.Body!);

    switch (messageBody.type) {
      case ISqsMessageType.OFFER: {
        const resOffer = await offerReCalculate(messageBody);
        responseEntity.push(resOffer);
        break;
      }
      case ISqsMessageType.CAMPAIGN: {
        const response = await campaignReCalculate(messageBody);
        responseEntity.push(response);
        break;
      }
      default:
        consola.info('recalculateRecipe sqs message type not defined');
        influxdb(500, 'sqs_message_type_not_defined');
    }

    await deleteMessage(message.ReceiptHandle!);
    return responseEntity.flat();
  } catch (e) {
    return [];
  }
};
