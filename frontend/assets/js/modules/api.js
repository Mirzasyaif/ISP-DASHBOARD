export function fetchAPI(endpoint, options) {
    // Wrapper around global DASH_CONFIG.fetchAPI
    // Assumes DASH_CONFIG is defined globally (window.ISP_CONFIG)
    return window.ISP_CONFIG.fetchAPI(endpoint, options);
}