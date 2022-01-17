export enum IRecipeType {
  CAMPAIGNS = 'campaigns',
  OFFERS = 'offers',
}

export enum IRedirectType {
  CAPS_OFFERS_CLICKS_OVER_LIMIT = 'capsOffersClicksOverLimit',
  CAPS_OFFERS_SALES_OVER_LIMIT = 'capsOffersSalesOverLimit',
}

export enum IRedirectReason {
  CAPS_OFFERS_CLICKS_OVER_LIMIT_CAP_REDIRECT = 'capsOffersClicksOverLimitCapRedirect',
  CAPS_OFFERS_CLICKS_OVER_LIMIT_EXIT_TRAFFIC = 'capsOffersClicksOverLimitExitTraffic',
  CAPS_OFFERS_SALES_OVER_LIMIT_EXIT_TRAFFIC = 'capsOffersSalesOverLimitExitTraffic',
  CAPS_OFFERS_SALES_OVER_LIMIT_CAP_REDIRECT = 'capsOffersSalesOverLimitCapRedirect',
}
