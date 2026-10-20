// Computed constants
const IS_DEV = process.env.ENVIRONMENT === 'development';

// Core layer constants
const CORE_LAYER_REPO = 'github:Moonbase-Systems/moonbase-core';
const CORE_LAYER_DEV_PATH = process.env.CORE_LAYER_PATH ?? '../moonbase-core';
const CORE_LAYER_PATH = IS_DEV ? CORE_LAYER_DEV_PATH : CORE_LAYER_REPO;

// Other constants
const COOKIE_MAX_AGE_DAYS = 30;

export { COOKIE_MAX_AGE_DAYS, CORE_LAYER_PATH, IS_DEV };
