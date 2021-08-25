import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";
import consola from "consola";
export const getOffers = async () => {

  try {
    const conn: Pool = await connect();

    let sql = `
          SELECT o.id                    AS offerId,
                 o.name                  AS name,
                 a.id                    AS advertiserId,
                 a.name                  AS advertiserName,
                 o.advertiser_manager_id AS advertiserManagerId,
                 v.id                    AS verticalId,
                 v.name                  AS verticalName,
                 o.currency_id           AS currencyId,
                 o.status                AS status,
                 o.payin                 AS payin,
                 o.payout                AS payout,
                 o.is_cpm_option_enabled AS isCpmOptionEnabled,
                 o.payout_percent        AS payoutPercent,
                 lp.id                   AS landingPageId,
                 lp.url                  AS landingPageUrl,
                 o.sfl_offer_geo_id      AS sflOfferGeoId,
                 g.rules                 AS geoRules,
                 g.sfl_offer_id          AS geoOfferId,
                 o.conversion_type       AS conversionType,
                 lps.rules               AS customLpRules,
                 c.sfl_offer_id          AS capOfferId,
                 o.use_start_end_date    AS useStartEndDate,
                 o.start_date            AS startDate,
                 o.end_date              AS endDate,
                 o.type
          FROM sfl_offers o
                   left join sfl_offer_landing_pages lp
                             ON lp.id = o.sfl_offer_landing_page_id
                   left join sfl_offer_geo g
                             ON g.sfl_offer_id = o.id
                   left join sfl_offer_custom_landing_pages lps
                             ON o.id = lps.sfl_offer_id
                   left join sfl_advertisers a
                             ON a.id = o.sfl_advertiser_id
                   left join sfl_vertical v
                             ON v.id = o.sfl_vertical_id
                   left join sfl_offers_cap c
                             ON c.sfl_offer_id = o.id
      `
    const [offers]: [any[], FieldPacket[]] = await conn.query(sql);
    conn.end();

    // console.log('Offers count:', offers.length)
    return offers

  } catch (e) {
    consola.error('setOffersToRedisError:', e)
  }

}