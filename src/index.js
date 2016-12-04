import { combineReducers as origCombineReducers } from 'redux';
import { createMixinsMethods } from './methods';
import { createActions } from './actions';
import { createReducer } from './reducer';
import { createSelectors } from './selectors';

/**
 * @class Model
 */
class Model {

  constructor(modelConfig) {
    this._config = modelConfig;

    const combineReducers = modelConfig.combineReducers || origCombineReducers;
    const stateToModel = modelConfig.stateToModel || ((state) => state[this.config().name]);
    this._mixinsMethods = createMixinsMethods(this);

    this.actions = createActions(this);
    this.reducer = createReducer(this, combineReducers);
    this.selectors = createSelectors(this, stateToModel);
  }

  config() {
    return this._config;
  }
}

/**
 * @param {Model} model
 * @return {{ actions: Object, selectors: Object, reducer: Function, model: Model }}
 */
function _createModel(model) {
  return {
    ...model.actions,
    selectors: model.selectors,
    reducer: model.reducer,
    model
  };
}


/**
 * @param {Object} config
 * @param {String} config.name
 * @param {Object} config.methods
 * @param {Object} config.reducers
 * @param {Object} config.selectors
 * @param {Function} [config.stateToModel]
 * @return {{ actions: Object, selectors: Object, reducer: Object, model: Model }}
 */
export function createModel(config) {
  const model = new Model(config);
  return _createModel(model);
}

/**
 * @param {Array} models
 * @param {Array} [mixins]
 * @param {Function} [combineReducers]
 * @param {Function} [stateToModel]
 * @return {{ models: [{ actions: Object, selectors: Object, reducer: Function, model: Model }], reducer: Function }}
 */
export function createModels({
  models, mixins = [], combineReducers = origCombineReducers,
  stateToModel = (state) => state.models }
) {
  const impls = models
    .map(modelConfig => new Model({
      ...modelConfig,
      combineReducers: combineReducers || modelConfig.combineReducers,
      mixins: [...mixins, ...(modelConfig.mixins || [])],
      stateToModel: (state) => stateToModel(state)[modelConfig.name]
    }));

  const modelsObject = impls.reduce((models, model) => ({
    ...models, [model.config().name]: _createModel(model)
  }), {});

  const reducer = combineReducers(impls.reduce((reducers, model) => ({
    ...reducers, [model.config().name]: model.reducer
  }), {}));

  return { models: modelsObject, reducer };
}