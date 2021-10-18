import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";
import consola from "consola";

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
               o.type,
               (SELECT COUNT(*) FROM sfl_offers_custom_payout p WHERE p.sfl_offer_id = o.id) AS customPayputCount
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
    await conn.end();

    // console.log('Offers count:', offers.length)
    return offers

  } catch (e) {
    consola.error('getOffersError:', e)
  }

}

export const getAggregatedOffers = async (id: number) => {

  try {
    const conn: Pool = await connect();
    const sql = `
        SELECT aggregatedOffers.aggregatedOfferId, aggregatedOffers.margin
        FROM (SELECT m.sfl_offer_id AS aggregatedOfferId, o.payin - o.payout AS margin
              FROM sfl_offers_aggregated m
                       JOIN sfl_offers o ON o.id = m.sfl_offer_id
              WHERE m.sfl_offer_aggregated_id = ${id}
              ORDER BY o.payin - o.payout DESC) AS aggregatedOffers
    `
    const [offersAggregated]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();
    return offersAggregated
  } catch (e) {
    consola.error(e)
  }
}
const caps = async (offerId: number) => {
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
               c.clicks_redirect_offer_id          AS capRedirectId,
               c.clicks_redirect_offer_use_default AS clicksRedirectOfferUseDefault,
               c.sales_day                         AS salesDaySetUpLimit,
               c.sales_week                        AS salesWeekSetUpLimit,
               c.sales_month                       AS salesMonthSetupLimit,
               c1.sales_day                        AS salesDayCurrent,
               c1.sales_week                       AS salesWeekCurrent,
               c1.sales_month                      AS salesMonthCurrent,
               c.sales_redirect_offer_id           AS capSalesRedirectOfferId,
               c.sales_redirect_offer_use_default  AS salesRedirectOfferUseDefault,
               c.start_date                        AS capsStartDate,
               c.end_date                          AS capsEndDate,
               c.use_start_end_date                AS useStartEndDate
        FROM sfl_offers o
                 join sfl_offers_cap c
                      ON c.sfl_offer_id = o.id
                 join sfl_offers_cap_current_data c1
                      ON c1.sfl_offer_id = o.id
        WHERE o.id = ${offerId}

    `
    const [offerCaps]: [any[], FieldPacket[]] = await conn.query(capSql)
    await conn.end();

    // consola.info('offerCaps:', offerCaps[0])

    return offerCaps.length !== 0 ? offerCaps[0] : []
  } catch (e) {
    consola.error('capsErr:', e)
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
  }

}

export const reCalculateOffer = async (offer: any) => {
  try {
    if (offer.type === 'aggregated') {
      offer.offersAggregatedIds = await getAggregatedOffers(offer.offerId)
      return offer
    }

    if (offer.capOfferId) {
      offer = await reCalculateOfferCaps(offer.offerId)
    }

    if (offer.useStartEndDate) {
      offer.startEndDateSetup = true
      const currentDate = new Date()
      offer.startEndDateSetting = {
        startDate: offer.startDate,
        endDate: offer.endDate,
        dateRangePass: currentDate > offer.startDate && currentDate < offer.endDate
      }
    }

    if (offer.customPayputCount > 0) {
      let customPayOutData = await getCustomPayoutPerGeo(offer.offerId)
      offer.customPayOutPerGeo = JSON.stringify(customPayOutData)
    }

    return offer
  } catch (e) {
    consola.error('reCalculateOfferError:', e)
  }
}

export const reCalculateOfferCaps = async (offerId: number) => {

  try {
    let offer: any = await getOffer(offerId)
    let offerCaps: any = await caps(offerId)
    const {
      clicksDaySetUpLimit,
      clicksWeekSetUpLimit,
      clicksMonthSetupLimit,
      clicksDayCurrent,
      clicksWeekCurrent,
      clicksMonthCurrent,
      capRedirectId,
      clicksRedirectOfferUseDefault,
      salesDaySetUpLimit,
      salesWeekSetUpLimit,
      salesMonthSetupLimit,
      salesDayCurrent,
      salesWeekCurrent,
      salesMonthCurrent,
      capSalesRedirectOfferId,
      salesRedirectOfferUseDefault,
      capsStartDate,
      capsEndDate,
      useStartEndDate
    } = offerCaps

    if (!clicksDaySetUpLimit
      && !clicksWeekSetUpLimit
      && !clicksMonthSetupLimit
      && !salesDaySetUpLimit
      && !salesWeekSetUpLimit
      && !salesMonthSetupLimit
    ) {
      return offer
    }

    offer.capSetup = true
    offer.capInfo = {}
    let capInfo: any = {
      sales: {},
      clicks: {},
      dateRangeSetUp: false
    }

    if (useStartEndDate && capsStartDate && capsEndDate) {
      capInfo.dateRangeSetUp = true
      capInfo.dateStart = capsStartDate
      capInfo.dateEnd = capsEndDate
      const currentDate = new Date()
      capInfo.currentDate = capsEndDate
      capInfo.dateRangePass = currentDate > capsStartDate && currentDate < capsEndDate

      if (!capInfo.dateRangePass) {
        offer.capInfo = capInfo
        capInfo.dateRangeNotPass = `capsStartDate:${capsStartDate} capsEndDate:${capsEndDate}`
        return offer
      }
    }

    capInfo.sales.day = {
      current: salesDayCurrent,
      limit: salesDaySetUpLimit
    }
    capInfo.sales.week = {
      current: salesWeekCurrent,
      limit: salesWeekSetUpLimit
    }
    capInfo.sales.month = {
      current: salesMonthCurrent,
      limit: salesMonthSetupLimit
    }

    if (salesMonthSetupLimit && salesWeekSetUpLimit && salesMonthSetupLimit) {
      offer.capsSalesUnderLimit = salesDayCurrent < salesDaySetUpLimit
        && salesWeekCurrent < salesWeekSetUpLimit
        && salesMonthCurrent < salesMonthSetupLimit
      offer.capsSalesOverLimit = !offer.capsSalesUnderLimit
    }

    capInfo.clicks.day = {
      current: clicksDayCurrent,
      limit: clicksDaySetUpLimit
    }
    capInfo.clicks.week = {
      current: clicksWeekCurrent,
      limit: clicksWeekSetUpLimit
    }
    capInfo.clicks.month = {
      current: clicksMonthCurrent,
      limit: clicksMonthSetupLimit
    }

    if (clicksDaySetUpLimit && clicksWeekSetUpLimit && clicksMonthSetupLimit) {
      offer.capsClicksUnderLimit = clicksDayCurrent < clicksDaySetUpLimit
        && clicksWeekCurrent < clicksWeekSetUpLimit
        && clicksMonthCurrent < clicksMonthSetupLimit
      offer.capsClicksOverLimit = !offer.capsClicksUnderLimit
    }


    offer.capInfo = capInfo
    if (offer.capsClicksOverLimit) {
      if (clicksRedirectOfferUseDefault) {
        offer.capInfo.exitTrafficClicks = true
        await offerReferred(offer, offer.offerIdRedirectExitTraffic, 'capsClicksOverLimit', 'capsClicksOverLimitExitTraffic')

      } else {
        offer.capInfo.capClicksRedirect = true
        await offerReferred(offer, capRedirectId, 'capsClicksOverLimit', 'capsClicksOverLimitCapRedirect')

      }

    }

    if (offer.capsSalesOverLimit) {

      if (salesRedirectOfferUseDefault) {
        offer.capInfo.exitTrafficSales = true
        await offerReferred(offer, offer.offerIdRedirectExitTraffic, 'capsSalesOverLimit', 'capsSalesOverLimitExitTraffic')

      } else {
        offer.capInfo.capSalesRedirect = true
        await offerReferred(offer, capSalesRedirectOfferId, 'capsSalesOverLimit', 'capsSalesOverLimitCapRedirect')

      }
    }
    if (!offer.landingPageUrl) {
      offer.landingPageUrl = `something happened to setup landingPageUrl offerId:${offer.offerId} see errors`
    }

    return offer
  } catch (e) {
    console.log(e)
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
               o.currency_id                                                                 AS currencyid,
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
               (SELECT COUNT(*) FROM sfl_offers_custom_payout p WHERE p.sfl_offer_id = o.id) AS customPayputCount,
               c.sfl_offer_id                                                                AS capOfferId
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
  }
}

const offerReferred = async (offer: any, referredOfferId: number, redirectType: string, redirectReason: string) => {
  offer.landingPageUrlOrigin = offer.landingPageUrl || ''
  offer.offerIdOrigin = offer.offerId || 0
  offer.referredOfferId = referredOfferId || 0
  offer.redirectType = redirectType
  offer.redirectReason = redirectReason
}
