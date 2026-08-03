import { viewModels } from "../viewModels/viewRegistry.js";
import {logger} from "../utils/logger.js";

/**
 * Middleware to attach and validate ViewModel
 * @param {string} viewName - Name of the view (e.g., "dashboard")
 */
export function attachVM(viewName) {
  return (req, res, next) => {
    const validator = viewModels[viewName];

    if (!validator) {
      throw new Error(`No ViewModel found for view: ${viewName}`);
    }

    // Initialize structured ViewModel
    req.vm = { req: {}, opt: {} };

    // Override res.render to validate and render
    const originalRender = res.render.bind(res);
    res.render = (view, data, callback) => {
      try {
        const renderData = data || req.vm;
        
        // Create flattened version ONLY for validation
        let validationData = renderData;
        if (renderData.req || renderData.opt) {
          validationData = { ...renderData.opt, ...renderData.req };
        }

        // Validate using the flattened data
        validator(validationData);

        // Automatic activePage detection for navbar highlighting
        const url = req.originalUrl || '';
        let activePage = 'home';

        if (url.includes('/seu/seus/new')) activePage = 'seu-seus-new';
        else if (/\/seu\/seus\/[^/]+$/.test(url.split('?')[0])) activePage = 'seu-seus-detail';
        else if (url.includes('/seu/seus')) activePage = 'seu-seus';
        else if (url.includes('/seu/packs')) activePage = 'seu-packs';
        else if (url.includes('/seu')) activePage = 'seu-dashboard';
        else if (url.includes('/stocks/data-viewer')) activePage = 'data-viewer';
        else if (url.includes('/stocks')) activePage = 'stocks';
        else if (url.includes('/quickview')) activePage = 'quickview';
        else if (url.includes('/agent')) activePage = 'agent';
        else if (url.includes('/dashboard')) activePage = 'dashboard';
        else if (url.includes('/trading/bollinger')) activePage = 'bollinger';
        else if (url.includes('/trading/donchian'))  activePage = 'donchian';
        else if (url.includes('/trading/rsi'))        activePage = 'rsi';
        else if (url.includes('/trading/macd'))        activePage = 'macd';
        else if (url.includes('/trading/confluence'))  activePage = 'confluence';
        else if (url.includes('/portfolio/dependency-map'))   activePage = 'dependency-map';
        else if (url.includes('/portfolio/value-chain'))     activePage = 'value-chain';
        else if (url.includes('/portfolio/multibagger'))    activePage = 'multibagger';
        else if (url.includes('/portfolio/sector-compare')) activePage = 'sector-compare';
        else if (url.includes('/portfolio/valuation-trend')) activePage = 'valuation-trend';
        else if (url.includes('/rotation/presets'))    activePage = 'rotation-presets';
        else if (url.includes('/rotation/custom'))     activePage = 'rotation-custom';
        else if (url.includes('/settings')) activePage = 'settings';
        else if (url.includes('/research/charts'))     activePage = 'research-charts';
        else if (url.includes('/research/indicators')) activePage = 'research-indicators';
        else if (url.includes('/research'))            activePage = 'research';
        else if (url.includes('/swing'))    activePage = 'swing';
        else if (url.includes('/learn'))       activePage = 'learn';
        else if (url.includes('/nism'))        activePage = 'nism';
        else if (url.includes('/investors'))   activePage = 'investors-trend';
        else if (url.includes('/forensics'))   activePage = 'forensics';
        else if (url.includes('/portfolio'))   activePage = 'portfolio';
        else if (url === '/aisworg' || url === '/aisworg/') activePage = 'seu-dashboard';

        // Render using a hybrid object: both flat keys AND structured req/opt
        const viewData = {
          activePage,
          // 1. If it's a flat object, spread all its keys
          ...(!(renderData.req || renderData.opt) ? renderData : {}),
          // 2. If it's structured, spread req and opt
          ...(renderData.opt || {}),
          ...(renderData.req || {}),
          // 3. Always provide the structured keys for templates that need them
          req: renderData.req || {},
          opt: renderData.opt || {},
          vm: renderData, 
          session: req.session,
          showDebugVM: req.query.debugVM !== undefined
        };

        originalRender(view, viewData, callback);
      } catch (error) {
        next(error);
      }
    };

    next();
  };
}
