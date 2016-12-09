import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import snakeCase from 'lodash/snakeCase';
import { methodNameToTypes, actionTypes } from './actions';
import { normalizeMethods } from './methods';

/**
 * @param {Model} model
 * @param {String|Function} method
 * @return {Function}
 */
function createDefaultMethodReducer(model, method) {
  if (!isFunction(method)) {
    return (state, action) => action;
  }

  const resultInitialState = {
    params: null,
    result: null,
    requesting: false,
    requested: false,
    error: null
  };

  const initialState = [];
  const [START, SUCCESS, ERROR] = methodNameToTypes(model.config().name, method.name || method);

  function reducer(state = initialState, action) {
    if (![START, SUCCESS, ERROR].includes(action.type)) {
      return state;
    }

    const error = action.type === ERROR ? action.meta : null;
    const params = action.payload || null;
    const requesting = action.type === START;
    const requested = action.type === SUCCESS || action.type === ERROR;
    const index = state.findIndex(row => isEqual(row.params, params));

    if (index === -1) {
      return [
        ...state,
        { ...resultInitialState, params, error, requesting, requested }
      ]
    }

    const result = action.type === START ? state[index].result : (
      action.type !== ERROR ? (action.meta || null) : null
    );

    return [
      ...state.slice(0, index),
      { ...state[index], result, error, requesting, requested: true },
      ...state.slice(index + 1, state.length)
    ];
  }

  reducer.isDefault = true;

  return reducer;
}

function createMethodReducer(model, method) {
  const definedReducers = model.config().reducers || {};
  const [START, SUCCESS, ERROR] = methodNameToTypes(model.config().name, method.name || method);
  return isFunction(definedReducers[method.name || method]) ?
    definedReducers[method.name || method]({ START, SUCCESS, ERROR }) :
    createDefaultMethodReducer(model, method);
}

/**
 * @param {Model} model
 * @param {Function} combineReducers
 * @return {Function}
 */
export function createReducer(model, combineReducers) {
  const methods = normalizeMethods(model.config().methods || {});

  const reducers = methods
    .reduce((reducers, method) => ({
      ...reducers,
      [method.name || method]: createMethodReducer(model, method)
    }), {});

  if (isFunction(model.config().reducer)) {
    reducers.model = model.config().reducer(
      actionTypes(model.config().name, Object.keys(model.actions))
    );
  }

  const mixinsReducers = (model.config().mixins || [])
    .reduce((mixinsReducers, mixin) => {
      if (isFunction(mixin.createReducer)) {
        const types = actionTypes(model.config().name, model._mixinsMethods[mixin.name] || []);
        return {
          ...mixinsReducers,
          [mixin.name]: mixin.createReducer(model, types, combineReducers)
        };
      }

      return {
        ...mixinsReducers,
        ...(model._mixinsMethods[mixin.name] || [])
          .filter((method) => !reducers[method.name || method])
          .reduce((mixinsReducers, method) => ({
            ...mixinsReducers,
            [method.name || method]: createMethodReducer(model, method)
          }), {})
      };
    }, {});

  return combineReducers({
    ...mixinsReducers,
    ...reducers
  });
}