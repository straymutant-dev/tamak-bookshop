function normalizeHostname(value: string | null | undefined): string {
  if (!value?.trim()) return '';

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return value.trim().toLowerCase().split('/')[0].split(':')[0];
  }
}

export function getPortalHosts(host: string) {
  const hostname = normalizeHostname(host);
  const adminTestHost = normalizeHostname(process.env.NEXT_PUBLIC_ADMIN_TEST_HOST);
  const siteTestHost = normalizeHostname(process.env.NEXT_PUBLIC_SITE_TEST_HOST);
  const configuredSiteHost = normalizeHostname(process.env.NEXT_PUBLIC_SITE_URL);
  const isTestHostPair = Boolean(adminTestHost && siteTestHost && adminTestHost !== siteTestHost);
  const isAdminSubdomain = hostname.startsWith('admin.');
  const isAdminTestHost = Boolean(adminTestHost && hostname === adminTestHost);
  const onAdminHost = isAdminSubdomain || isAdminTestHost;
  const rootDomain = isAdminSubdomain ? hostname.slice('admin.'.length) : hostname;

  return {
    onAdminHost,
    adminHostFor: adminTestHost || `admin.${rootDomain}`,
    mainHostFor: isTestHostPair && (hostname === adminTestHost || hostname === siteTestHost)
      ? siteTestHost
      : isAdminTestHost
        ? configuredSiteHost || rootDomain
        : rootDomain,
  };
}
