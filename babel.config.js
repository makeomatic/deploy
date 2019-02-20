module.exports = (api) => {
  const plugins = [
    '@babel/plugin-transform-strict-mode',
    '@babel/plugin-proposal-class-properties',
  ];

  api.cache(() => process.env.NODE_ENV);

  return {
    plugins,
  };
};
