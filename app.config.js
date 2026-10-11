// Reads app.json. A web export that lives under a sub-path (the project site serves it at /Grimoire/app) sets
// GRIMOIRE_WEB_BASE_URL so asset and route URLs are built for that path; phones and a root-served build leave it unset.
module.exports = ({ config }) => {
  const baseUrl = process.env.GRIMOIRE_WEB_BASE_URL;
  return baseUrl ? { ...config, experiments: { ...(config.experiments ?? {}), baseUrl } } : config;
};
