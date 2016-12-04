import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import difference from 'lodash/difference';
import omit from 'lodash/omit';
import mapValues from 'lodash/mapValues';
import { normalizeMethods } from './methods';

let globalState = {};

/**
 * @param {Boolean} hasCustomReducer
 * @return {Function}
 */
function createDefaultMethodSelector(hasCustomReducer) {
  if (hasCustomReducer) {
    return function () {
      return this.getMethodState();
    };
  }

  return function (...params) {
    return (this.getMethodState() || []).find(row => isEqual(params, row.params)) ||
      { result: null, requesting: false, requested: false };
  };
}

function createMethodSelector(model, method, hasCustomReducer) {
  const definedSelectors = model.config().selectors || {};
  const definedReducers = model.config().reducers || {};

  return definedSelectors[method.name || method] ||
    createDefaultMethodSelector(hasCustomReducer || !!definedReducers[method.name || method])
}

/**
 * @param {Model} model
 * @param {Function} stateToModel
 * @return {Object}
 */
export function createSelectors(model, stateToModel) {
  const definedSelectors = model.config().selectors || {};

  function modelState() {
    return stateToModel(globalState) || {};
  }

  const binder = {
    getState: () => globalState,
    getModelState: () => modelState(),
    model
  };

  const modelSelectors = normalizeMethods(model.config().methods || [])
    .reduce((selectors, method) => {
      const methodName = method.name || method;
      const selector = createMethodSelector(model, method)
        .bind({ ...binder, getMethodState: () => modelState()[methodName], name: methodName });

      return {
        ...selectors,
        [methodName]: selector,
        [`${methodName}Result`]: (...params) => (selector(...params) || {}).result
      };
    }, {});

  difference(Object.keys(definedSelectors), Object.keys(modelSelectors))
    .forEach((selectorName) => {
      modelSelectors[selectorName] = definedSelectors[selectorName].bind(binder)
    });

  const mixinsSelectors = (model.config().mixins || [])
    .reduce((mixinsSelectors, mixin) => {
      const mixinName = mixin.name;

      if (isFunction(mixin.createSelectors)) {
        return {
          ...mixinsSelectors, ...mapValues(
            omit(mixin.createSelectors(model) || {}, Object.keys(modelSelectors)),
            (selector) => selector.bind({
              ...binder, name: selector.name,
              getMethodState: () => {
                return isFunction(mixin.createReducer) ?
                  modelState()[mixinName][selector.name] :
                  modelState()[selector.name];
              },
              getMixinState: () => modelState()[mixinName]
            })
          )
        };
      }

      return {
        ...mixinsSelectors,
        ...(model._mixinsMethods[mixinName] || [])
          .filter((method) => !modelSelectors[method.name || method])
          .reduce((mixinsSelectors, method) => {
            const methodName = method.name || method;
            const selector = createMethodSelector(model, method, isFunction(mixin.createReducer))
              .bind({
                ...binder, name: methodName,
                getMethodState: () => {
                  return isFunction(mixin.createReducer) ?
                    modelState()[mixinName] :
                    modelState()[methodName];
                },
                getMixinState: () => modelState()[mixinName]
              });

            return {
              ...mixinsSelectors,
              [methodName]: selector,
              [`${methodName}Result`]: (...params) => (selector(...params) || {}).result
            };
          }, {})
      }
    }, {});

  const allSelectors = {
    ...modelSelectors,
    ...mixinsSelectors
  };

  return (state) => {
    globalState = state;
    return allSelectors;
  };
}