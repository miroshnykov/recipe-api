export enum IRecipeType {
  CAMPAIGNS = 'campaigns',
  OFFERS = 'offers'
}

export enum IRedirectType {
  CAPS_CLICKS_OVER_LIMIT = 'capsClicksOverLimit',
  CAPS_SALES_OVER_LIMIT = 'capsSalesOverLimit'
}

export enum IRedirectReason {
  CAPS_CLICKS_OVER_LIMIT_CAP_REDIRECT = 'capsClicksOverLimitCapRedirect',
  CAPS_CLICKS_OVER_LIMIT_EXIT_TRAFFIC = 'capsClicksOverLimitExitTraffic',
  CAPS_SALES_OVER_LIMIT_EXIT_TRAFFIC = 'capsSalesOverLimitExitTraffic',
  CAPS_SALES_OVER_LIMIT_CAP_REDIRECT = 'capsSalesOverLimitCapRedirect',
}
