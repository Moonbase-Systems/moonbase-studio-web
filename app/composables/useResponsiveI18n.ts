import { breakpointsTailwind, useBreakpoints } from '@vueuse/core';

export const useResponsiveI18n = () => {
  const { t, te } = useI18n();

  const breakpoints = useBreakpoints(breakpointsTailwind);
  const isMobile = breakpoints.smaller('md');

  function tResponsive(key: string): string {
    if (!isMobile.value) {
      return t(key);
    }

    const mobileKey = `${key}.mobile`;

    if (te(mobileKey)) {
      return t(mobileKey);
    }

    return t(key);
  }

  return {
    tResponsive,
  };
};
