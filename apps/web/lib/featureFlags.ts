const readBool = (value: string | undefined): boolean => value === "true";

export const featureFlags = {
  promotions: readBool(process.env.NEXT_PUBLIC_ENABLE_PROMOTIONS),
  dmBroadcast: readBool(process.env.NEXT_PUBLIC_ENABLE_DM_BROADCAST),
  ppvPosts: readBool(process.env.NEXT_PUBLIC_ENABLE_PPV_POSTS),
  moderation: readBool(process.env.NEXT_PUBLIC_ENABLE_MODERATION),
  analytics: readBool(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS),
  mobileNavPolish: readBool(process.env.NEXT_PUBLIC_ENABLE_MOBILE_NAV_POLISH),
  smartPreviews: readBool(process.env.NEXT_PUBLIC_ENABLE_SMART_PREVIEWS),
  promoGenerator: readBool(process.env.NEXT_PUBLIC_ENABLE_PROMO_GENERATOR),
  translations: readBool(process.env.NEXT_PUBLIC_ENABLE_TRANSLATIONS),
  aiTools: readBool(process.env.NEXT_PUBLIC_ENABLE_AI_TOOLS),
  cartoonAvatar: readBool(process.env.NEXT_PUBLIC_ENABLE_CARTOON_AVATAR),
};

