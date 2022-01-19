import consola from 'consola';
import { ICampaign } from '../interfaces/campaigns';
import {
  ICapInfo, ICapResult, ICaps, ICapsType,
} from '../interfaces/caps';
import { influxdb } from '../metrics';
import { getCampaign, getCampaignCaps } from '../models/campaignsModel';

export const reCalculateCampaignCaps = async (campaignId: number) => {
  try {
    const campaign: ICampaign = await getCampaign(campaignId);
    if (!campaign.capsEnabled) {
      return campaign;
    }

    const campaignCaps: ICaps = await getCampaignCaps(campaignId);
    const {
      clicksDaySetUpLimit,
      clicksWeekSetUpLimit,
      clicksMonthSetupLimit,
      clicksDayCurrent,
      clicksWeekCurrent,
      clicksMonthCurrent,
      clicksRedirectOfferId,
      salesDaySetUpLimit,
      salesWeekSetUpLimit,
      salesMonthSetupLimit,
      salesDayCurrent,
      salesWeekCurrent,
      salesMonthCurrent,
      salesRedirectOfferId,
      capsStartDate,
      capsEndDate,
    } = campaignCaps;

    if (!clicksDaySetUpLimit
      && !clicksWeekSetUpLimit
      && !clicksMonthSetupLimit
      && !salesDaySetUpLimit
      && !salesWeekSetUpLimit
      && !salesMonthSetupLimit
    ) {
      return campaign;
    }

    campaign.capSetup = true;
    const capInfo: ICapInfo = {
      sales: {
        day: {
          current: 0,
          limit: 0,
        },
        week: {
          current: 0,
          limit: 0,
        },
        month: {
          current: 0,
          limit: 0,
        },
      },
      clicks: {
        day: {
          current: 0,
          limit: 0,
        },
        week: {
          current: 0,
          limit: 0,
        },
        month: {
          current: 0,
          limit: 0,
        },
      },
      dateRangeSetUp: null,
      currentDate: null,
      dateRangePass: null,
      dateRangeNotPassDescriptions: null,
      capsType: null,
      capsSalesUnderLimit: null,
      capsSalesUnderLimitDetails: null,
      capsSalesOverLimit: null,
      capsSalesOverLimitDetails: null,
      capsClicksUnderLimit: null,
      capsClicksUnderLimitDetails: null,
      capsClicksOverLimit: null,
      capsClicksOverLimitDetails: null,
    };

    if (capsStartDate && capsEndDate) {
      capInfo.dateRangeSetUp = true;
      capInfo.dateStart = capsStartDate;
      capInfo.dateEnd = capsEndDate;
      const currentDate = new Date();
      capInfo.currentDate = capsEndDate;
      capInfo.dateRangePass = currentDate > capsStartDate && currentDate < capsEndDate;

      if (!capInfo.dateRangePass) {
        capInfo.dateRangeNotPassDescriptions = `capsStartDate:${capsStartDate} capsEndDate:${capsEndDate}`;
        capInfo.capsType = ICapsType.CAPS_CAMPAIGN_DATA_RANGE_NOT_PASS;
        campaign.capInfo = capInfo;
        return campaign;
      }
    }

    capInfo.sales.day.current = salesDayCurrent;
    capInfo.sales.day.limit = salesDaySetUpLimit;

    capInfo.sales.week.current = salesWeekCurrent;
    capInfo.sales.week.limit = salesWeekSetUpLimit;

    capInfo.sales.month.current = salesMonthCurrent;
    capInfo.sales.month.limit = salesMonthSetupLimit;

    const conditionsSetupSales: ICapResult[] = [
      {
        period: 'day',
        limit: salesDaySetUpLimit,
        currentAmount: salesDayCurrent,
      },
      {
        period: 'week',
        limit: salesWeekSetUpLimit,
        currentAmount: salesWeekCurrent,
      },
      {
        period: 'month',
        limit: salesMonthSetupLimit,
        currentAmount: salesMonthCurrent,
      },
    ];
    const conditionsSetupSalesNotEmpty = conditionsSetupSales.filter((i) => (i.limit));

    const salesResultUnderLimit: ICapResult[] = [];
    const salesResultOverLimit: ICapResult[] = [];
    conditionsSetupSalesNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        salesResultUnderLimit.push(i);
      } else {
        salesResultOverLimit.push(i);
      }
    });

    if (salesResultUnderLimit.length !== 0
      && salesResultUnderLimit.length === conditionsSetupSalesNotEmpty.length
    ) {
      capInfo.capsSalesUnderLimit = true;
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
      capInfo.capsType = ICapsType.CAPS_CAMPAIGN_UNDER_LIMIT;
    } else {
      capInfo.capsSalesUnderLimit = false;
      capInfo.capsSalesUnderLimitDetails = salesResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (salesResultOverLimit.length !== 0) {
      capInfo.capsSalesOverLimit = true;
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    } else {
      capInfo.capsSalesOverLimit = false;
      capInfo.capsSalesOverLimitDetails = salesResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    capInfo.clicks.day.current = clicksDayCurrent;
    capInfo.clicks.day.limit = clicksDaySetUpLimit;

    capInfo.clicks.week.current = clicksWeekCurrent;
    capInfo.clicks.week.limit = clicksWeekSetUpLimit;

    capInfo.clicks.month.current = clicksMonthCurrent;
    capInfo.clicks.month.limit = clicksMonthSetupLimit;

    const conditionsSetupClicks: ICapResult[] = [
      {
        period: 'day',
        limit: clicksDaySetUpLimit,
        currentAmount: clicksDayCurrent,
      },
      {
        period: 'week',
        limit: clicksWeekSetUpLimit,
        currentAmount: clicksWeekCurrent,
      },
      {
        period: 'month',
        limit: clicksMonthSetupLimit,
        currentAmount: clicksMonthCurrent,
      },
    ];
    const conditionsSetupClicksNotEmpty = conditionsSetupClicks.filter((i) => (i.limit));

    const clicksResultUnderLimit: ICapResult[] = [];
    const clicksResultOverLimit: ICapResult[] = [];
    conditionsSetupClicksNotEmpty.forEach((i: ICapResult) => {
      if (i.currentAmount < i.limit) {
        clicksResultUnderLimit.push(i);
      } else {
        clicksResultOverLimit.push(i);
      }
    });

    if (clicksResultUnderLimit.length !== 0
      && clicksResultUnderLimit.length === conditionsSetupClicksNotEmpty.length
    ) {
      capInfo.capsClicksUnderLimit = true;
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
      capInfo.capsType = ICapsType.CAPS_CAMPAIGN_UNDER_LIMIT;
    } else {
      capInfo.capsClicksUnderLimit = false;
      capInfo.capsClicksUnderLimitDetails = clicksResultUnderLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (clicksResultOverLimit.length !== 0) {
      capInfo.capsClicksOverLimit = true;
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    } else {
      capInfo.capsClicksOverLimit = false;
      capInfo.capsClicksOverLimitDetails = clicksResultOverLimit.map((i: { period: string }) => (i.period)).join(',');
    }

    if (capInfo.capsClicksUnderLimit) {
      capInfo.campaignCapsOfferIdRedirect = clicksRedirectOfferId;
      capInfo.capsType = ICapsType.CAPS_CAMPAIGN_UNDER_LIMIT_ClICKS;
    }

    if (capInfo.capsSalesUnderLimit) {
      capInfo.campaignCapsOfferIdRedirect = salesRedirectOfferId;
      capInfo.capsType = ICapsType.CAPS_CAMPAIGN_UNDER_LIMIT_SALES;
    }

    campaign.capInfo = capInfo;

    return campaign;
  } catch (e) {
    consola.error(e);
    influxdb(500, 're_calculate_campaign_caps_error');
    return [];
  }
};
