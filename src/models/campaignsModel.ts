import { FieldPacket, Pool } from 'mysql2/promise';
import consola from 'consola';
import { connect } from '../db/mysql';
import { influxdb } from '../metrics';

// eslint-disable-next-line consistent-return
export const getCampaigns = async () => {
  try {
    const conn: Pool = await connect();

    const sql = `
        SELECT c.id                       AS campaignId,
               c.name                     AS name,
               c.sfl_offer_id             AS offerId,
               c.affiliate_id             AS affiliateId,
               a.status                   AS affiliateStatus,
               a.affiliate_type           AS affiliateType,
               c.status                   AS campaignStatus,
               c.payout                   AS payout,
               c.payout_percent           AS payoutPercent,
               a.affiliate_manager_id     AS affiliateManagerId,
               cap.enabled                AS capsEnabled
        FROM sfl_offer_campaigns c
                 LEFT JOIN sfl_affiliates a ON a.id = c.affiliate_id
                 LEFT JOIN sfl_offer_campaign_cap cap ON cap.sfl_offer_campaign_id = c.id AND cap.enabled = true
        WHERE c.status in ('active','inactive','pending','blocked')
--          and c.id in (998960, 49)
    `;
    const [campaigns]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();

    return campaigns;
  } catch (e) {
    consola.error('getCampaignsError:', e);
    influxdb(500, 'get_campaigns_error');
  }
};

export const getCampaign = async (id: number) => {
  try {
    const conn: Pool = await connect();

    const sql = `
        SELECT c.id                   AS campaignId,
               c.name                 AS name,
               c.sfl_offer_id         AS offerId,
               c.affiliate_id         AS affiliateId,
               c.payout               AS payout,
               c.payout_percent       AS payoutPercent,
               a.status               AS affiliateStatus,
               c.status               AS campaignStatus,
               a.affiliate_manager_id AS affiliateManagerId,
               a.affiliate_type       AS affiliateType,
               cap.enabled            AS capsEnabled
        FROM sfl_offer_campaigns c
                 LEFT JOIN sfl_affiliates a ON a.id = c.affiliate_id
                 LEFT JOIN sfl_offer_campaign_cap cap ON cap.sfl_offer_campaign_id = c.id AND cap.enabled = true
        WHERE c.id = ${id}
    `;
    const [campaign]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();
    return campaign.length !== 0 ? campaign[0] : [];
  } catch (e) {
    consola.error('getCampaignError:', e);
    influxdb(500, 'get_campaign_error');
    return [];
  }
};

export const getCampaignCaps = async (id: number) => {
  try {
    const conn: Pool = await connect();

    const sql = `
        SELECT c.id                         AS campaignId,
               cap.clicks_day               AS clicksDaySetUpLimit,
               cap.clicks_week              AS clicksWeekSetUpLimit,
               cap.clicks_month             AS clicksMonthSetupLimit,
               capData.clicks_day           AS clicksDayCurrent,
               capData.clicks_week          AS clicksWeekCurrent,
               capData.clicks_month         AS clicksMonthCurrent,
               cap.clicks_redirect_offer_id AS clicksRedirectOfferId,
               cap.sales_day                AS salesDaySetUpLimit,
               cap.sales_week               AS salesWeekSetUpLimit,
               cap.sales_month              AS salesMonthSetupLimit,
               capData.sales_day            AS salesDayCurrent,
               capData.sales_week           AS salesWeekCurrent,
               capData.sales_month          AS salesMonthCurrent,
               cap.sales_redirect_offer_id  AS salesRedirectOfferId,
               cap.start_date               AS capsStartDate,
               cap.end_date                 AS capsEndDate
        FROM sfl_offer_campaigns c
                 JOIN sfl_offer_campaign_cap cap
                      ON cap.sfl_offer_campaign_id = c.id
                 LEFT JOIN sfl_offer_campaign_cap_current_data capData
                           ON c.id = capData.sfl_offer_campaign_id
        WHERE c.id = ${id}
          AND cap.enabled = true
    `;
    const [campaignCaps]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();
    return campaignCaps.length !== 0 ? campaignCaps[0] : [];
  } catch (e) {
    consola.error('getCampaignCapsError:', e);
    influxdb(500, 'get_campaign_caps_error');
    return [];
  }
};
