import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";
import consola from "consola";
export const getCampaigns = async () => {

  try {
    const conn: Pool = await connect();

    let sql = `
        SELECT c.id                   AS campaignId,
               c.name                 AS name,
               c.sfl_offer_id         AS offerId,
               c.affiliate_id         AS affiliateId,
               c.payout               AS payout,
               c.payout_percent       AS payoutPercent,
               a.affiliate_manager_id AS affiliateManagerId
        FROM sfl_offer_campaigns c
                 LEFT JOIN sfl_affiliates a ON a.id = c.affiliate_id
        WHERE c.status = 'active'
      `
    const [campaigns]: [any[], FieldPacket[]] = await conn.query(sql);
    conn.end();

    return campaigns

  } catch (e) {
    consola.error('getCampaignsError:', e)
  }

}

export const getCampaign = async (id:number) => {

  try {
    const conn: Pool = await connect();

    let sql = `
        SELECT c.id                   AS campaignId,
               c.name                 AS name,
               c.sfl_offer_id         AS offerId,
               c.affiliate_id         AS affiliateId,
               c.payout               AS payout,
               c.payout_percent       AS payoutPercent,
               a.affiliate_manager_id AS affiliateManagerId
        FROM sfl_offer_campaigns c
                 LEFT JOIN sfl_affiliates a ON a.id = c.affiliate_id
        WHERE c.id = ${id}
      `
    const [campaign]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();
    return campaign.length !== 0 ? campaign[0] : []

  } catch (e) {
    consola.error('getCampaignError:', e)
  }

}