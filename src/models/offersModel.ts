import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";
import consola from "consola";
import {influxdb} from "../metrics";
import {IOffer, IOffersMargin} from "../interfaces/offers";
import {reCalculateOffer} from "../services/offersCaps";

export const getOffers = async () => {
  try {
    const conn: Pool = await connect();
    let sql = `
        SELECT o.id                                                                          AS offerId,
               o.name                                                                        AS name,
               a.id                                                                          AS advertiserId,
               a.name                                                                        AS advertiserName,
               o.advertiser_manager_id                                                       AS advertiserManagerId,
               v.id                                                                          AS verticalId,
               v.name                                                                        AS verticalName,
               o.currency_id                                                                 AS currencyId,
               o.status                                                                      AS status,
               o.payin                                                                       AS payin,
               o.payout                                                                      AS payout,
               o.is_cpm_option_enabled                                                       AS isCpmOptionEnabled,
               o.payout_percent                                                              AS payoutPercent,
               lp.id                                                                         AS landingPageId,
               lp.url                                                                        AS landingPageUrl,
               o.sfl_offer_geo_id                                                            AS sflOfferGeoId,
               g.rules                                                                       AS geoRules,
               g.sfl_offer_id                                                                AS geoOfferId,
               o.conversion_type                                                             AS conversionType,
               lps.rules                                                                     AS customLpRules,
               c.sfl_offer_id                                                                AS capOfferId,
               o.use_start_end_date                                                          AS useStartEndDate,
               o.start_date                                                                  AS startDate,
               o.end_date                                                                    AS endDate,
               o.descriptions                                                                AS descriptions,
               o.offer_id_redirect                                                           AS offerIdRedirectExitTraffic,
               o.type                                                                        AS type,
               (SELECT COUNT(*) FROM sfl_offers_custom_payout p WHERE p.sfl_offer_id = o.id) AS customPayOutCount
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
        WHERE o.status != 'inactive'
    `
    const [offers]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();

    // console.log('Offers count:', offers.length)
    return offers

  } catch (e) {
    consola.error('getOffersError:', e)
    influxdb(500, `get_offers_error`)
    return []
  }
}

export const getAggregatedOffers = async (id: number) => {
  try {
    const conn: Pool = await connect();
    const sql = `
        SELECT m.sfl_offer_id AS aggregatedOfferId,
               o.payin,
               o.payout,
               o.currency_id,
               o.id,
               (SELECT r.rate
                FROM sfl_exchange_rate r
                WHERE r.currency_id_from = o.currency_id
                ORDER BY r.date_added DESC
                                 LIMIT 1)     rate
        FROM sfl_offers_aggregated m
            JOIN sfl_offers o
        ON o.id = m.sfl_offer_id
        WHERE m.sfl_offer_aggregated_id = ${id}
        ORDER BY o.payin - o.payout DESC
    `
    const [offersAggregated]: [any[], FieldPacket[]] = await conn.query(sql);

    await conn.end();

    const calculateMargin: IOffersMargin[] = offersAggregated.map(i => {
      let margin: number
      if (i.rate) {
        const payInEx: number = Number(i.payin) * Number(i.rate)
        const payOutEx: number = Number(i.payout) * Number(i.rate)
        margin = Math.round((payInEx - payOutEx + Number.EPSILON) * 100) / 100;
      } else {
        margin = Math.round((Number(i.payin) - Number(i.payout) + Number.EPSILON) * 100) / 100;
      }
      const aggregatedOfferId: number = i.aggregatedOfferId

      return {
        aggregatedOfferId,
        margin
      }
    })

    let formatOffers = calculateMargin.sort((a: IOffersMargin, b: IOffersMargin) => (a.margin > b.margin) ? -1 : 1)
    for (let offer of formatOffers) {
      let offerInfo_: IOffer = await getOffer(offer.aggregatedOfferId)
      let offerInfo = await reCalculateOffer(offerInfo_)

      if ("capsEnabled" in offerInfo && offerInfo?.capsEnabled!) {
        if (offerInfo?.capInfo?.capsSalesOverLimit) {
          offer.capsOverLimitSales = offerInfo?.capInfo?.capsSalesOverLimit
        }
        if (offerInfo?.capInfo?.capsClicksOverLimit) {
          offer.capsOverLimitClicks = offerInfo?.capInfo?.capsClicksOverLimit
        }
      }

      if ("startEndDateSetup" in offerInfo && offerInfo.startEndDateSetup) {
        // @ts-ignore
        if (!offerInfo.startEndDateSetting.dateRangePass) {
          offer.dateRangeNotPass = true
        }
      }

      const geoRules = JSON.parse(offerInfo_.geoRules)
      if (geoRules.geo) {
        const countriesList = geoRules?.geo?.map((i: { country: string; }) => (i.country))
        if (countriesList.length !== 0) {
          offer.countriesRestrictions = countriesList.join(',')
        }
      }

      const customLpRules = JSON.parse(offerInfo_.customLpRules)
      if (customLpRules) {
        const customLpCountriesList = customLpRules.customLPRules.map((i: { country: string; }) => (i.country))
        if (customLpCountriesList.length !== 0) {
          offer.customLpCountriesRestrictions = customLpCountriesList.join(',')
        }
      }
    }

    return formatOffers
  } catch (e) {
    consola.error(e)
    influxdb(500, `get_aggregated_offer_error`)
  }
}

export const getOfferCaps = async (offerId: number) => {
  try {
    const conn: Pool = await connect();
    const capSql = `
        SELECT o.id                                AS offerId,
               c.clicks_day                        AS clicksDaySetUpLimit,
               c.clicks_week                       AS clicksWeekSetUpLimit,
               c.clicks_month                      AS clicksMonthSetupLimit,
               c1.clicks_day                       AS clicksDayCurrent,
               c1.clicks_week                      AS clicksWeekCurrent,
               c1.clicks_month                     AS clicksMonthCurrent,
               c.clicks_redirect_offer_id          AS clicksRedirectOfferId,
               c.clicks_redirect_offer_use_default AS clicksRedirectOfferUseDefault,
               c.sales_day                         AS salesDaySetUpLimit,
               c.sales_week                        AS salesWeekSetUpLimit,
               c.sales_month                       AS salesMonthSetupLimit,
               c1.sales_day                        AS salesDayCurrent,
               c1.sales_week                       AS salesWeekCurrent,
               c1.sales_month                      AS salesMonthCurrent,
               c.sales_redirect_offer_id           AS salesRedirectOfferId,
               c.sales_redirect_offer_use_default  AS salesRedirectOfferUseDefault,
               c.start_date                        AS capsStartDate,
               c.end_date                          AS capsEndDate,
               c.use_start_end_date                AS useStartEndDate
        FROM sfl_offers o
                 join sfl_offers_cap c
                      ON c.sfl_offer_id = o.id
                 left join sfl_offers_cap_current_data c1
                           ON c1.sfl_offer_id = o.id
        WHERE o.id = ${offerId}
          AND c.enabled = true
    `
    const [offerCaps]: [any[], FieldPacket[]] = await conn.query(capSql)
    await conn.end();

    // consola.info('offerCaps:', offerCaps[0])

    return offerCaps.length !== 0 ? offerCaps[0] : []
  } catch (e) {
    consola.error('capsErr:', e)
    influxdb(500, `get_caps_offer_error`)
  }
}

export const getCustomPayoutPerGeo = async (offerId: number) => {
  try {
    const conn: Pool = await connect();
    const customPayOutSql = `
        SELECT p.sfl_offer_id   AS offerId,
               p.geo            as geo,
               p.payin          as payIn,
               p.payout         as payOut,
               p.payment_type   as paymentType,
               p.payout_percent as payoutPercent
        FROM sfl_offers_custom_payout p
        WHERE p.sfl_offer_id = ${offerId}
    `

    const [customPayOutData]: [any[], FieldPacket[]] = await conn.query(customPayOutSql)
    await conn.end();

    return customPayOutData
  } catch (e) {
    consola.error('capsErr:', e)
    influxdb(500, `get_custom_payout_error`)
  }
}

export const getOffer = async (id: number) => {
  try {
    const conn: Pool = await connect();

    const sql = `
        SELECT o.id                                                                          AS offerId,
               o.name                                                                        AS name,
               a.id                                                                          AS advertiserId,
               a.name                                                                        AS advertiserName,
               v.id                                                                          AS verticalId,
               v.name                                                                        AS verticalName,
               o.advertiser_manager_id                                                       AS advertiserManagerId,
               o.conversion_type                                                             AS conversionType,
               o.currency_id                                                                 AS currencyId,
               o.status                                                                      AS status,
               o.payin                                                                       AS payin,
               o.payout                                                                      AS payout,
               o.payout_percent                                                              AS payoutPercent,
               o.is_cpm_option_enabled                                                       AS isCpmOptionEnabled,
               lp.id                                                                         AS landingPageId,
               lp.url                                                                        AS landingPageUrl,
               o.sfl_offer_geo_id                                                            AS sflOfferGeoId,
               g.rules                                                                       AS geoRules,
               g.sfl_offer_id                                                                AS geoOfferId,
               lps.rules                                                                     AS customLpRules,
               o.offer_id_redirect                                                           AS offerIdRedirectExitTraffic,
               o.use_start_end_date                                                          AS useStartEndDate,
               o.start_date                                                                  AS startDate,
               o.end_date                                                                    AS endDate,
               o.type                                                                        AS type,
               (SELECT COUNT(*) FROM sfl_offers_custom_payout p WHERE p.sfl_offer_id = o.id) AS customPayOutCount,
               c.sfl_offer_id                                                                AS capOfferId,
               c.enabled                                                                     AS capsEnabled
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
        WHERE o.id = ${id}
    `
    const [offer]: [any[], FieldPacket[]] = await conn.query(sql)
    await conn.end();

    return offer.length !== 0 ? offer[0] : []

  } catch (e) {
    consola.error(e)
    influxdb(500, `get_offer_error`)
  }
}

